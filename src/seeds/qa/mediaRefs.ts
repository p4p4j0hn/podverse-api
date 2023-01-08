import { faker } from '@faker-js/faker'
import { getRepository } from 'typeorm'
import { createMediaRef } from '~/controllers/mediaRef'
import { Episode } from '~/entities'
import {
  getQAUserByEmail,
  userFreeTrialExpiredEmail,
  userFreeTrialValidEmail,
  userPremiumExpiredEmail,
  userPremiumValidEmail
} from './users'
import { _logEnd, _logStart, logPerformance } from '~/lib/utility'

type MediaRefLite = {
  owner: string
  isOfficialChapter: boolean
  imageUrl: string | null
  isPublic: boolean
  linkUrl: string | null
  startTime: number
  endTime: number | null
  title: string
  episodeId: string
}

export const generateQAMediaRefs = async () => {
  logPerformance('generateQAMediaRefs', _logStart)

  const userFreeTrialValid = await getQAUserByEmail(userFreeTrialValidEmail)
  const userFreeTrialExpired = await getQAUserByEmail(userFreeTrialExpiredEmail)
  const userPremiumValid = await getQAUserByEmail(userPremiumValidEmail)
  const userPremiumExpired = await getQAUserByEmail(userPremiumExpiredEmail)

  if (userFreeTrialValid && userFreeTrialExpired && userPremiumValid && userPremiumExpired) {
    await generateMediaRefsForUser(userFreeTrialValid.id)
    await generateMediaRefsForUser(userFreeTrialExpired.id)
    await generateMediaRefsForUser(userPremiumValid.id)
    await generateMediaRefsForUser(userPremiumExpired.id)
  }

  logPerformance('generateQAMediaRefs', _logEnd)
}

const generateMediaRefsForUser = async (userId: string) => {
  const episodeRepository = getRepository(Episode)

  const episodes = await episodeRepository
    .createQueryBuilder('episode')
    .select('*')
    .where('episode."isPublic" = TRUE')
    .orderBy('RANDOM()')
    .limit(33)
    .getRawMany()

  for (const episode of episodes) {
    const startTime = getRandomStartTime()
    const endTime = getRandomEndTime(startTime)
    const mediaRefLite: MediaRefLite = {
      owner: userId,
      isOfficialChapter: false,
      imageUrl: episode.imageUrl,
      isPublic: true,
      linkUrl: episode.linkUrl,
      startTime,
      endTime,
      title: getRandomTitle(),
      episodeId: episode.id
    }

    await createMediaRef(mediaRefLite)
  }
}

const getRandomStartTime = () => {
  return faker.datatype.number({ min: 0, max: 300 })
}

const getRandomEndTime = (startTime: number) => {
  return startTime % 2 ? startTime + 30 : null
}

const getRandomTitle = () => {
  const numberOfWords = faker.datatype.number({ min: 0, max: 20 })
  return faker.lorem.words(numberOfWords)
}
