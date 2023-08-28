const Joi = require('joi')
import { validateBaseBody, validateBaseQuery } from './base'

const validateFeedUrlUpdate = async (ctx, next) => {
  const schema = Joi.object().keys({
    id: Joi.string().min(7).max(14).required(),
    isAuthority: Joi.boolean(),
    podcastId: Joi.string(),
    url: Joi.string()
  })

  await validateBaseBody(schema, ctx, next)
}

const validateMediaRefUpdate = async (ctx, next) => {
  const schema = Joi.object().keys({
    authors: Joi.array().items(Joi.string()),
    categories: Joi.array().items(Joi.string()),
    endTime: Joi.number().integer().min(1).allow(null).allow(''),
    episodeId: Joi.string(),
    id: Joi.string(),
    isPublic: Joi.boolean(),
    startTime: Joi.number().integer().min(0).required(),
    title: Joi.string().allow(null).allow('')
  })

  await validateBaseBody(schema, ctx, next)
}

const validatePayPalOrderUpdate = async (ctx, next) => {
  const schema = Joi.object().keys({
    paymentID: Joi.string(),
    paymentToken: Joi.string(),
    state: Joi.string()
  })

  await validateBaseBody(schema, ctx, next)
}

const validatePlaylistUpdate = async (ctx, next) => {
  const schema = Joi.object().keys({
    description: Joi.string().allow(null).allow(''),
    id: Joi.string().min(7).max(14).required(),
    isPublic: Joi.boolean(),
    itemsOrder: Joi.array().items(Joi.string()),
    mediaRefs: Joi.array().items(Joi.string()),
    ownerId: Joi.string(),
    title: Joi.string().allow(null).allow('')
  })

  await validateBaseBody(schema, ctx, next)
}

const validateUserMembershipUpdate = async (ctx, next) => {
  const schema = Joi.object().keys({
    id: Joi.string().min(7).max(14).required(),
    membershipExpiration: Joi.date().iso().required()
  })

  await validateBaseBody(schema, ctx, next)
}

const validateUserUpdate = async (ctx, next) => {
  const schema = Joi.object().keys({
    email: Joi.string(),
    id: Joi.string().min(7).max(14).required(),
    isPublic: Joi.boolean(),
    name: Joi.string().allow(null).allow('')
  })

  await validateBaseBody(schema, ctx, next)
}

const validateAddOrUpdateUserHistoryItem = async (ctx, next) => {
  const schema = Joi.object().keys({
    completed: Joi.boolean(),
    episodeId: Joi.string().allow(null),
    forceUpdateOrderDate: Joi.boolean(),
    liveItem: Joi.object().allow(null),
    mediaFileDuration: Joi.number().integer().min(0),
    mediaRefId: Joi.string().allow(null),
    userPlaybackPosition: Joi.number().integer().min(0).required()
  })

  await validateBaseBody(schema, ctx, next)
}

const validateAddOrUpdateMultipleUserHistoryItems = async (ctx, next) => {
  const schema = Joi.object().keys({
    episodeIds: Joi.array().items(Joi.string())
  })

  await validateBaseBody(schema, ctx, next)
}

const validateAddOrUpdateUserQueueItem = async (ctx, next) => {
  const schema = Joi.object().keys({
    episodeId: Joi.string().allow(null),
    mediaRefId: Joi.string().allow(null),
    queuePosition: Joi.number().integer().min(0).required()
  })

  await validateBaseBody(schema, ctx, next)
}

const validateUserHistoryItemRemove = async (ctx, next) => {
  const schema = Joi.object()
    .keys({
      episodeId: Joi.string(),
      mediaRefId: Joi.string()
    })
    .min(1)
    .max(1)

  await validateBaseQuery(schema, ctx, next)
}

const validateUserNowPlayingItemUpdate = async (ctx, next) => {
  const schema = Joi.object().keys({
    episodeId: Joi.string().allow(null),
    mediaRefId: Joi.string().allow(null),
    liveItem: Joi.object().allow(null),
    userPlaybackPosition: Joi.number().integer().min(0).required()
  })

  await validateBaseQuery(schema, ctx, next)
}

export {
  validateFeedUrlUpdate,
  validateMediaRefUpdate,
  validatePayPalOrderUpdate,
  validatePlaylistUpdate,
  validateAddOrUpdateUserHistoryItem,
  validateAddOrUpdateMultipleUserHistoryItems,
  validateAddOrUpdateUserQueueItem,
  validateUserHistoryItemRemove,
  validateUserMembershipUpdate,
  validateUserNowPlayingItemUpdate,
  validateUserUpdate
}
