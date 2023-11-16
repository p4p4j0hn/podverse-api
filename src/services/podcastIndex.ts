import axios from 'axios'
import { config } from '~/config'
import { getConnection, getRepository } from 'typeorm'
import { getAuthorityFeedUrlByPodcastIndexId, getFeedUrlByUrl } from '~/controllers/feedUrl'
import { connectToDb } from '~/lib/db'
import { convertPIValueTagToPVValueTagArray } from '~/lib/podcastIndex'
import { parseFeedUrl } from '~/services/parser'
import { addFeedUrlsByPodcastIndexId } from '~/services/queue'
import { request } from '~/lib/request'
import { getPodcastByPodcastIndexId } from '~/controllers/podcast'
import { Podcast } from '~/entities'
import { ValueTag } from 'podverse-shared'
const shortid = require('shortid')
const sha1 = require('crypto-js/sha1')
const encHex = require('crypto-js/enc-hex')
const csv = require('csvtojson')
const createError = require('http-errors')
const { podcastIndexConfig, userAgent } = config

const axiosRequest = async (url) => {
  const apiHeaderTime = new Date().getTime() / 1000
  const hash = sha1(config.podcastIndexConfig.authKey + config.podcastIndexConfig.secretKey + apiHeaderTime).toString(
    encHex
  )

  return axios({
    url,
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      'X-Auth-Key': podcastIndexConfig.authKey,
      'X-Auth-Date': apiHeaderTime,
      Authorization: hash
    }
  })
}

const getValueTagEnabledPodcastIdsFromPIRecursively = async (accumulatedPodcastIndexIds: number[], startAt = 1) => {
  const url = `${podcastIndexConfig.baseUrl}/podcasts/bytag?podcast-value=true&max=5000&start_at=${startAt}`
  const response = await axiosRequest(url)
  const { data } = response

  for (const feed of data.feeds) {
    accumulatedPodcastIndexIds.push(feed.id)
  }

  if (data.nextStartAt) {
    return await getValueTagEnabledPodcastIdsFromPIRecursively(accumulatedPodcastIndexIds, data.nextStartAt)
  }

  return accumulatedPodcastIndexIds
}

export const getValueTagEnabledPodcastIdsFromPI = async () => {
  const accumulatedPodcastIndexIds = []
  const nextStartAt = 1
  const podcastIndexIds = await getValueTagEnabledPodcastIdsFromPIRecursively(accumulatedPodcastIndexIds, nextStartAt)

  return podcastIndexIds
}

const getRecentlyUpdatedDataRecursively = async (accumulatedFeedData: any[] = [], since?: number) => {
  console.log('getRecentlyUpdatedDataRecursively')
  console.log('accumulatedFeedData.length', accumulatedFeedData.length)
  const currentTime = Math.floor(Date.now() / 1000)
  const axiosResponseData = await getRecentlyUpdatedData(since)
  const { data, itemCount, nextSince } = axiosResponseData
  console.log('itemCount', itemCount)
  console.log('since', since)
  console.log('nextSince', nextSince)
  const { feeds } = data
  console.log('feeds', feeds.length)
  accumulatedFeedData = [...accumulatedFeedData, ...feeds]
  console.log('accumulatedFeedData', accumulatedFeedData.length)
  if (itemCount >= 5000) {
    const timeRemainingSince = nextSince - currentTime
    console.log('timeRemainingSince', timeRemainingSince)
    return getRecentlyUpdatedDataRecursively(accumulatedFeedData, timeRemainingSince)
  } else {
    console.log('return final data', accumulatedFeedData.length)
    return accumulatedFeedData
  }
}

/*
  since = in seconds
*/
const getRecentlyUpdatedData = async (since?: number) => {
  let url = `${podcastIndexConfig.baseUrl}/recent/data?max=5000`

  url += `&since=${since ? since : -1800}`

  const response = await axiosRequest(url)
  return response && response.data
}

// const getRecentlyUpdatedPodcastFeeds = async () => {
//   const url = `${podcastIndexConfig.baseUrl}/recent/feeds?sort=discovery&max=1000`
//   const response = await axiosRequest(url)
//   return response && response.data
// }

type PodcastIndexDataFeed = {
  feedId: number
  feedUrl: string
}

/*
  This function determines if the feed.url returned by Podcast Index is not currently
  the authority feedUrl in our database. If it is not, then update our database to use
  the newer feed.url provided by Podcast Index.
*/
export const updateFeedUrlsIfNewAuthorityFeedUrlDetected = async (podcastIndexDataFeeds: PodcastIndexDataFeed[]) => {
  try {
    console.log('updateFeedUrlsIfNewAuthorityFeedUrlDetected', podcastIndexDataFeeds?.length)
    const client = await getConnection().createEntityManager()
    if (Array.isArray(podcastIndexDataFeeds)) {
      for (const podcastIndexDataFeed of podcastIndexDataFeeds) {
        try {
          if (podcastIndexDataFeed.feedId) {
            const currentFeedUrl = await getAuthorityFeedUrlByPodcastIndexId(podcastIndexDataFeed.feedId.toString())
            if (currentFeedUrl && currentFeedUrl.url !== podcastIndexDataFeed.feedUrl) {
              const podcastIndexFeed = {
                id: podcastIndexDataFeed.feedId,
                url: podcastIndexDataFeed.feedUrl
              }
              await createOrUpdatePodcastFromPodcastIndex(client, podcastIndexFeed)
            }
          }
        } catch (err) {
          console.log('updateFeedUrlsIfNewAuthorityFeedUrlDetected podcastIndexDataFeed', err)
        }
      }
    }
  } catch (err) {
    console.log('updateFeedUrlsIfNewAuthorityFeedUrlDetected err', err)
  }
}

/**
 * addRecentlyUpdatedFeedUrlsToPriorityQueue
 *
 * Request a list of all podcast feeds that have been updated
 * within the past X time from Podcast Index, then add
 * the feeds that have a matching podcastIndexId in our database
 * to the queue for parsing.
 * sinceTime = epoch time to start from in seconds
 */
export const addRecentlyUpdatedFeedUrlsToPriorityQueue = async (sinceTime?: number) => {
  try {
    await connectToDb()

    /* If no sinceTime provided, get all updated feeds from the past hour */
    if (!sinceTime) {
      sinceTime = Math.round(Date.now() / 1000) - 3600
    }
    const recentlyUpdatedFeeds = await getRecentlyUpdatedDataRecursively([], sinceTime)
    console.log('total recentlyUpdatedFeeds count', recentlyUpdatedFeeds.length)

    await updateFeedUrlsIfNewAuthorityFeedUrlDetected(recentlyUpdatedFeeds)

    const recentlyUpdatedPodcastIndexIds = [] as any[]
    for (const item of recentlyUpdatedFeeds) {
      const { feedId } = item
      if (feedId) {
        recentlyUpdatedPodcastIndexIds.push(feedId)
      }
    }

    // TODO: THIS TAKES A VERY LONG TIME TO COMPLETE,
    // AND IS ARBITRARILY LIMITED TO 10000...
    // const uniquePodcastIndexIds = [...new Set(recentlyUpdatedPodcastIndexIds)].slice(0, 10000)

    // console.log('unique recentlyUpdatedPodcastIndexIds count', uniquePodcastIndexIds.length)

    // Send the feedUrls with matching podcastIndexIds found in our database to
    // the priority parsing queue for immediate parsing.
    if (recentlyUpdatedPodcastIndexIds.length > 0) {
      await addFeedUrlsByPodcastIndexId(recentlyUpdatedPodcastIndexIds)
    }
  } catch (error) {
    console.log('addRecentlyUpdatedFeedUrlsToPriorityQueue', error)
  }
}

export const getPodcastFromPodcastIndexById = async (id: string) => {
  const url = `${podcastIndexConfig.baseUrl}/podcasts/byfeedid?id=${id}`
  const response = await axiosRequest(url)
  return response && response.data
}

export const getPodcastValueTagForPodcastIndexId = async (id: string) => {
  const podcast = await getPodcastFromPodcastIndexById(id)
  const pvValueTagArray = convertPIValueTagToPVValueTagArray(podcast.feed.value)
  return pvValueTagArray
}

export const getPodcastFromPodcastIndexByGuid = async (podcastGuid: string) => {
  const url = `${podcastIndexConfig.baseUrl}/podcasts/byguid?guid=${podcastGuid}`
  let podcastIndexPodcast: any = null
  try {
    const response = await axiosRequest(url)
    podcastIndexPodcast = response.data
  } catch (error) {
    // assume a 404
  }

  if (!podcastIndexPodcast) {
    throw new createError.NotFound('Podcast not found in Podcast Index')
  }

  return podcastIndexPodcast
}

// These getValueTagFor* services were intended for getting "value tag" info from Podcast Index,
// but at this point they more broadly is for retrieving the "remote item" data
// our client side apps need. The most common use case involves needing value tags
// for value time splits (VTS), but we also return additional data as the
// second item in the response data array, which gets handled as a "chapter"
// in the client side apps, to display to the listener which value time split track
// (usually a song) is playing right now.
export const getValueTagForChannelFromPodcastIndexByGuids = async (podcastGuid: string) => {
  const url = `${podcastIndexConfig.baseUrl}/podcasts/byguid?guid=${podcastGuid}`
  let podcastValueTag: ValueTag[] | null = null

  try {
    const response = await axiosRequest(url)
    const data = response.data
    if (data?.feed?.value) {
      podcastValueTag = convertPIValueTagToPVValueTagArray(data.feed.value)
    }
  } catch (error) {
    // assume a 404
  }

  if (!podcastValueTag || podcastValueTag?.length === 0) {
    throw new createError.NotFound('Value tags not found')
  }

  return podcastValueTag
}

// see note above
export const getValueTagForItemFromPodcastIndexByGuids = async (podcastGuid: string, episodeGuid: string) => {
  const url = `${podcastIndexConfig.baseUrl}/episodes/byguid?podcastguid=${podcastGuid}&guid=${episodeGuid}`
  let episodeValueTag: ValueTag[] | null = null

  try {
    const response = await axiosRequest(url)
    const data = response.data

    if (data?.episode?.value) {
      episodeValueTag = convertPIValueTagToPVValueTagArray(data.episode.value)
    }
  } catch (error) {
    // assume a 404
  }

  if (!episodeValueTag || episodeValueTag?.length === 0) {
    throw new createError.NotFound('Value tags not found')
  }

  return episodeValueTag
}

export const getEpisodesFromPodcastIndexById = async (podcastIndexId: string) => {
  const url = `${podcastIndexConfig.baseUrl}/episodes/byfeedid?id=${podcastIndexId}&max=1000`
  const response = await axiosRequest(url)
  return response && response.data
}

export const getAllEpisodesFromPodcastIndexById = async (podcastIndexId: string) => {
  // TODO: AFAIK Podcast Index does not support recursively paginating beyond 1000 results
  // https://podcastindex-org.github.io/docs-api/#get-/episodes/byfeedid
  // const allEpisodes = []
  // let recursionLimit = 0

  // const getEpisodesRecursively = async (id: string) => {
  //   try {
  //     if (recursionLimit >= 50) return
  //     const episodes = await getEpisodesFromPodcastIndexById(id)
  //     if (episodes.length > 0) {
  //       allEpisodes.concat(episodes)
  //     }
  //     if (episodes.length === 1000) {
  //     }
  //   } catch (error) {
  //     console.log('getAllEpisodesFromPodcastIndexById error', id, error)
  //   }
  // }

  // await getEpisodesRecursively(id)

  const response = await getEpisodesFromPodcastIndexById(podcastIndexId)
  const allEpisodes = response?.items

  return allEpisodes
}

export const getAllEpisodeValueTagsFromPodcastIndexById = async (podcastIndexId: string) => {
  const episodes = await getAllEpisodesFromPodcastIndexById(podcastIndexId)
  const pvEpisodesValueTagsByGuid = {}
  for (const episode of episodes) {
    if (episode?.value && episode?.guid) {
      const pvValueTagArray = convertPIValueTagToPVValueTagArray(episode.value)
      if (pvValueTagArray?.length > 0) {
        pvEpisodesValueTagsByGuid[episode.guid] = pvValueTagArray
      }
    }
  }
  return pvEpisodesValueTagsByGuid
}

export const addOrUpdatePodcastFromPodcastIndex = async (client: any, podcastIndexId: string) => {
  const podcastIndexPodcast = await getPodcastFromPodcastIndexById(podcastIndexId)
  const allowNonPublic = true
  await createOrUpdatePodcastFromPodcastIndex(client, podcastIndexPodcast.feed)
  const feedUrl = await getAuthorityFeedUrlByPodcastIndexId(podcastIndexId, allowNonPublic)

  try {
    const forceReparsing = true
    const cacheBust = true
    await parseFeedUrl(feedUrl, forceReparsing, cacheBust, allowNonPublic)
  } catch (error) {
    console.log('addOrUpdatePodcastFromPodcastIndex error', error)
  }
}

export const addFeedsByPodcastIndexIdToQueue = async (client: any, podcastIndexIds: string[]) => {
  for (const podcastIndexId of podcastIndexIds) {
    try {
      const podcastIndexItem = await getPodcastFromPodcastIndexById(podcastIndexId)
      if (podcastIndexItem?.feed) {
        await createOrUpdatePodcastFromPodcastIndex(client, podcastIndexItem.feed)
      }
    } catch (error) {
      console.log('addFeedsByPodcastIndexIdToQueue error', error)
    }
  }

  await addFeedUrlsByPodcastIndexId(podcastIndexIds)
}

const getNewFeeds = async () => {
  const currentTime = new Date().getTime()
  const { podcastIndexNewFeedsSinceTime } = podcastIndexConfig
  // add 5 seconds to the query to prevent podcasts falling through the cracks between requests
  const offset = 5000
  const startRangeTime = Math.floor((currentTime - (podcastIndexNewFeedsSinceTime + offset)) / 1000)

  console.log('currentTime----', currentTime)
  console.log('startRangeTime-', startRangeTime)
  const url = `${podcastIndexConfig.baseUrl}/recent/newfeeds?since=${startRangeTime}&max=1000`
  console.log('url------------', url)
  const response = await axiosRequest(url)

  return response && response.data
}

/**
 * addNewFeedsFromPodcastIndex
 *
 * Request a list of all podcast feeds that have been added
 * within the past X minutes from Podcast Index, then add
 * that feed to our database if it doesn't already exist.
 */
export const addNewFeedsFromPodcastIndex = async () => {
  console.log('addNewFeedsFromPodcastIndex')
  await connectToDb()
  const client = await getConnection().createEntityManager()
  try {
    const response = await getNewFeeds()
    const newFeeds = response.feeds
    console.log('total newFeeds count', newFeeds.length)
    for (const item of newFeeds) {
      try {
        await createOrUpdatePodcastFromPodcastIndex(client, item)
        const feedUrl = await getFeedUrlByUrl(item.url)
        await parseFeedUrl(feedUrl)
      } catch (error) {
        console.log('addNewFeedsFromPodcastIndex item', item)
        console.log('addNewFeedsFromPodcastIndex error', error)
      }
    }
  } catch (error) {
    console.log('addNewFeedsFromPodcastIndex', error)
  }
}

/**
 * syncWithFeedUrlsCSVDump
 *
 * Basically, this function parses a CSV file of feed URLs provided by Podcast Index,
 * then adds each feed URL to our database if it doesn't already exist,
 * and retires the previous feed URLs saved in our database for that podcast if any exist.
 *
 * Longer explanation...
 * This looks for a file named podcastIndexFeedUrlsDump.csv, then iterates through
 * every podcastIndexItem in the file, then retrieves all existing feedUrls in our database
 * that have a matching podcastIndexIds.
 *
 * When no feedUrl for that podcastIndexId exists, then creates a new feedUrl
 * using the podcastIndexItem's information.
 *
 * When a feedUrl for that podcastIndexId exists, then promote the item's new url
 * to be the authority feedUrl for that podcast, and demote any other feedUrls for that podcast.
 */
export const syncWithFeedUrlsCSVDump = async (rootFilePath) => {
  await connectToDb()

  try {
    const csvFilePath = `${rootFilePath}/temp/podcastIndexFeedUrlsDump.csv`
    console.log('syncWithFeedUrlsCSVDump csvFilePath', csvFilePath)
    const client = await getConnection().createEntityManager()
    await csv()
      .fromFile(csvFilePath)
      .subscribe((json) => {
        return new Promise(async (resolve) => {
          await new Promise((r) => setTimeout(r, 25))
          try {
            await createOrUpdatePodcastFromPodcastIndex(client, json)
          } catch (error) {
            console.log('podcastIndex:syncWithFeedUrlsCSVDump subscribe error', error)
          }

          resolve()
        })
      })
  } catch (error) {
    console.log('podcastIndex:syncWithFeedUrlsCSVDump', error)
  }
}

async function createOrUpdatePodcastFromPodcastIndex(client, item) {
  console.log('-----------------------------------')
  console.log('createOrUpdatePodcastFromPodcastIndex')

  if (!item || !item.url || !item.id) {
    console.log('no item found')
  } else {
    const url = item.url
    const podcastIndexId = item.id
    const itunesId = parseInt(item.itunes_id) ? item.itunes_id : null

    console.log('feed url', url, podcastIndexId, itunesId)

    let existingPodcast = await getExistingPodcast(client, podcastIndexId)

    if (!existingPodcast) {
      console.log('podcast does not already exist')
      const isPublic = true

      await client.query(
        `
        INSERT INTO podcasts (id, "authorityId", "podcastIndexId", "isPublic")
        VALUES ($1, $2, $3, $4);
      `,
        [shortid(), itunesId, podcastIndexId, isPublic]
      )

      existingPodcast = await getExistingPodcast(client, podcastIndexId)
    } else {
      const setSQLCommand = itunesId
        ? `SET ("podcastIndexId", "authorityId") = (${podcastIndexId}, ${itunesId})`
        : `SET "podcastIndexId" = ${podcastIndexId}`
      await client.query(
        `
        UPDATE "podcasts"
        ${setSQLCommand}
        WHERE "podcastIndexId"=$1
      `,
        [podcastIndexId.toString()]
      )
      console.log('updatedPodcast id: ', existingPodcast.id)
      console.log('updatedPodcast podcastIndexId: ', podcastIndexId)
      console.log('updatedPodcast itunesId: ', itunesId)
    }

    const existingFeedUrls = await client.query(
      `
      SELECT id, url
      FROM "feedUrls"
      WHERE "podcastId"=$1
    `,
      [existingPodcast.id]
    )

    /*
      In case the feed URL already exists in our system, but is assigned to another podcastId,
      get the feed URL for the other podcastId, so it can be assigned to the new podcastId.
    */
    const existingFeedUrlsByFeedUrl = await client.query(
      `
        SELECT id, url
        FROM "feedUrls"
        WHERE "url"=$1
      `,
      [url]
    )

    const combinedExistingFeedUrls = [...existingFeedUrls, ...existingFeedUrlsByFeedUrl]

    console.log('existingFeedUrls count', existingFeedUrls.length)

    for (const existingFeedUrl of combinedExistingFeedUrls) {
      console.log('existingFeedUrl url / id', existingFeedUrl.url, existingFeedUrl.id)

      const isMatchingFeedUrl = url === existingFeedUrl.url

      await client.query(
        `
        UPDATE "feedUrls"
        SET ("isAuthority", "podcastId") = (${isMatchingFeedUrl ? 'TRUE' : 'NULL'}, '${existingPodcast.id}')
        WHERE id=$1
      `,
        [existingFeedUrl.id]
      )
    }

    const updatedFeedUrlResults = await client.query(
      `
      SELECT id, url
      FROM "feedUrls"
      WHERE url=$1
    `,
      [url]
    )
    const updatedFeedUrl = updatedFeedUrlResults[0]

    if (updatedFeedUrl) {
      console.log('updatedFeedUrl already exists url / id', updatedFeedUrl.url, updatedFeedUrl.id)
    } else {
      console.log('updatedFeedUrl does not exist url / id')
      const isAuthority = true
      await client.query(
        `
        INSERT INTO "feedUrls" (id, "isAuthority", "url", "podcastId")
        VALUES ($1, $2, $3, $4);
      `,
        [shortid(), isAuthority, url, existingPodcast.id]
      )
    }
  }
  console.log('*** finished entry')
}

const getExistingPodcast = async (client, podcastIndexId) => {
  let podcasts = [] as any

  if (podcastIndexId) {
    podcasts = await client.query(
      `
      SELECT "authorityId", "podcastIndexId", id, title
      FROM podcasts
      WHERE "podcastIndexId"=$1;
    `,
      [podcastIndexId]
    )
  }

  return podcasts[0]
}

export const hideDeadPodcasts = async (fileUrl?: string) => {
  console.log('hideDeadPodcasts')
  const url = fileUrl ? fileUrl : 'https://public.podcastindex.org/podcastindex_dead_feeds.csv'
  console.log('url', url)

  const response = await request(url, {
    headers: {
      'Content-Type': 'text/csv'
    }
  })

  try {
    await csv({ noheader: true })
      .fromString(response)
      .subscribe((json) => {
        return new Promise(async (resolve) => {
          await new Promise((r) => setTimeout(r, 5))
          try {
            if (json?.field1) {
              try {
                const podcast = await getPodcastByPodcastIndexId(json.field1)
                if (podcast.isPublic) {
                  const repository = getRepository(Podcast)
                  podcast.isPublic = false
                  await new Promise((resolve) => setTimeout(resolve, 100))
                  await repository.save(podcast)
                  console.log('feed hidden successfully!', json.field1, json.field2)
                }
              } catch (error) {
                if (error.message.indexOf('not found') === -1) {
                  console.log('error hiding podcast json', json)
                  console.log('error hiding podcast json error message:', error)
                } else {
                  // console.log('feed already hidden', json.field1, json.field2)
                }
              }
            }
          } catch (error) {
            console.log('podcastIndex:hideDeadPodcasts subscribe error', error)
          }

          resolve()
        })
      })
  } catch (error) {
    console.log('podcastIndex:hideDeadPodcasts', error)
  }

  console.log('hideDeadPodcasts finished')
}
