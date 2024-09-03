import { EntityManager } from 'typeorm';
import { Item } from '@orm/entities/item/item';
import { ItemAbout } from '@orm/entities/item/itemAbout';
import { ItemItunesEpisodeTypeEnum } from '@orm/entities/item/itemItunesEpisodeType';
import { BaseOneService } from '@orm/services/base/baseOneService';

type ItemAboutDto = {
  duration: string | null
  explicit: boolean | null
  website_link_url: string | null
  item_itunes_episode_type: ItemItunesEpisodeTypeEnum
}

export class ItemAboutService extends BaseOneService<ItemAbout, 'item'> {
  constructor(transactionalEntityManager?: EntityManager) {
    super(ItemAbout, 'item', transactionalEntityManager);
  }

  async update(item: Item, dto: ItemAboutDto): Promise<ItemAbout> {
    return super._update(item, dto, { relations: ['item_itunes_episode_type'] });
  }
}
