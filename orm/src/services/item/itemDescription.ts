import { EntityManager } from 'typeorm';
import { Item } from '@orm/entities/item/item';
import { ItemDescription } from '@orm/entities/item/itemDescription';
import { BaseOneService } from '@orm/services/base/baseOneService';

type ItemDescriptionDto = {
  value: string
}

export class ItemDescriptionService extends BaseOneService<ItemDescription, 'item'> {
  constructor(transactionalEntityManager?: EntityManager) {
    super(ItemDescription, 'item', transactionalEntityManager);
  }

  async update(item: Item, dto: ItemDescriptionDto): Promise<ItemDescription> {
    return super._update(item, dto);
  }
}
