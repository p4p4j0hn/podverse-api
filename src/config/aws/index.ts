export default {
  queueUrls: {
    feedsToParse: {
      liveQueueUrl: process.env.AWS_QUEUE_FEED_PARSER_LIVE_URL,
      priorityQueueUrl: process.env.AWS_QUEUE_FEED_PARSER_PRIORITY_URL,
      queueUrl: process.env.AWS_QUEUE_FEED_PARSER_URL,
      errorsQueueUrl: process.env.AWS_QUEUE_FEED_PARSER_ERRORS_URL
    },
    selfManagedFeedsToParse: {
      queueUrl: process.env.AWS_QUEUE_SELF_MANAGED_FEED_PARSER_URL
    }
  },
  region: process.env.AWS_REGION,
  imageS3BucketName: process.env.AWS_IMAGE_S3_BUCKET_NAME,
  imageCloudFrontOrigin: process.env.AWS_IMAGE_CLOUDFRONT_ORIGIN,
  backupDatbaseS3BucketName: process.env.AWS_BACKUP_DATABASE_S3_BUCKET_NAME,
  s3ImageLimitUpdateDays: process.env.AWS_S3_IMAGE_LIMIT_UPDATE_DAYS
    ? parseInt(process.env.AWS_S3_IMAGE_LIMIT_UPDATE_DAYS, 10)
    : 30
}
