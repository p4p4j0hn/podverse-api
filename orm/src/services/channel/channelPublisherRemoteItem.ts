import { ChannelPublisher } from '@orm/entities/channel/channelPublisher';
import { ChannelPublisherRemoteItem } from '@orm/entities/channel/channelPublisherRemoteItem';
import { MediumValueValueEnum } from '@orm/entities/mediumValue';
import { BaseRemoteItemsService } from '@orm/lib/baseRemoteItemsService';

type ChannelPublisherRemoteItemDto = {
  feed_guid: string
  feed_url: string | null
  item_guid: string | null
  // title: string | null
  medium: MediumValueValueEnum | null
}

export class ChannelPublisherRemoteItemService extends BaseRemoteItemsService<ChannelPublisherRemoteItem, 'channel_publisher'> {
  constructor() {
    super(ChannelPublisherRemoteItem, 'channel_publisher');
  }

  async update(channel_publisher: ChannelPublisher, dto: ChannelPublisherRemoteItemDto): Promise<ChannelPublisherRemoteItem> {
    return super.update(channel_publisher, dto);
  }

  async updateMany(channel_publisher: ChannelPublisher, dtos: ChannelPublisherRemoteItemDto[]): Promise<ChannelPublisherRemoteItem[]> { 
    return super.updateMany(channel_publisher, dtos);
  }
}
