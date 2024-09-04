import { CommandLineArgs } from "@workers/commands";
import { queueRSSAddAll as queueRSSAddAllFunction } from '@queue/functions/queue/rss/addAll';
import { QueueName, queueNames } from "@queue/services/rabbitmq";

export const queueRSSAddAll = async (args: CommandLineArgs) => {
  const queueName = Array.isArray(args.q) ? args.q[0] : args.q;
  if (!queueName) {
    throw new Error('queueName (-q) parameter is required');
  }

  if (!queueNames.includes(queueName as QueueName)) {
    throw new Error(`Invalid queueName. Allowed values are: ${queueNames.join(', ')}`);
  }

  await queueRSSAddAllFunction({ queueName: queueName as QueueName });
};
