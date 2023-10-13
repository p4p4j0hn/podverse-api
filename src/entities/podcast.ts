/* eslint-disable @typescript-eslint/no-unused-vars */

import { IsUrl, IsInt, Min, ValidateIf } from 'class-validator'
import type { LiveItemStatus, PodcastMedium } from 'podverse-shared'
import { Author, Category, Episode, FeedUrl, Notification } from '~/entities'
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm'
import { generateShortId } from '~/lib/utility'
import { Phase6ValueTimeSplit } from 'podcast-partytime/dist/parser/phase/phase-6'

type Funding = {
  url: string
  value?: string
}

export type Value = {
  method: string
  suggested?: string
  type: string
  recipients: ValueRecipient[]
  valueTimeSplits?: Phase6ValueTimeSplit[]
}

type ValueRecipient = {
  address: string
  customKey?: string
  customValue?: string
  fee?: boolean
  name?: string
  split: string
  type: string
}

export const podcastItunesTypeDefaultValue = 'episodic'

@Index(['hasVideo', 'pastAllTimeTotalUniquePageviews'])
@Index(['hasVideo', 'pastHourTotalUniquePageviews'])
@Index(['hasVideo', 'pastDayTotalUniquePageviews'])
@Index(['hasVideo', 'pastWeekTotalUniquePageviews'])
@Index(['hasVideo', 'pastMonthTotalUniquePageviews'])
@Index(['hasVideo', 'pastYearTotalUniquePageviews'])
@Entity('podcasts')
export class Podcast {
  @PrimaryColumn('varchar', {
    default: generateShortId(),
    length: 14
  })
  id: string

  @Index()
  @Column()
  @Generated('increment')
  int_id: number

  @Index()
  @Column({ nullable: true, unique: true })
  podcastIndexId?: string

  // This replaces the podcast.guid column
  @Index()
  @Column({ type: 'uuid', nullable: true })
  podcastGuid?: string

  // deprecated: use podcastGuid instead
  @Column({ nullable: true })
  guid?: string

  @Index()
  @Column({ nullable: true, unique: true })
  authorityId?: string

  @Column({ default: false })
  alwaysFullyParse?: boolean

  @Column({ default: false })
  credentialsRequired?: boolean

  @Column({ nullable: true })
  description?: string

  @Column({ nullable: true })
  embedApprovedMediaUrlPaths?: string

  @Column({ default: false })
  excludeCacheBust?: boolean

  @Column({ default: false })
  feedLastParseFailed?: boolean

  @Index()
  @Column({ nullable: true })
  feedLastUpdated?: Date

  @Column('simple-json', { nullable: true })
  funding: Funding[]

  @Column({ default: false })
  hasLiveItem: boolean

  @Column({ default: false })
  hasPodcastIndexValueTag?: boolean

  @Column({ default: false })
  hasSeasons: boolean

  @Column({ default: false })
  hasVideo: boolean

  @Column({ default: false })
  hideDynamicAdsWarning?: boolean

  @ValidateIf((a) => a.imageUrl != null)
  @IsUrl()
  @Column({ nullable: true })
  imageUrl?: string

  @Column({ default: false })
  isExplicit: boolean

  @Index()
  @Column({ default: false })
  isPublic: boolean

  @Column({ default: podcastItunesTypeDefaultValue })
  itunesFeedType: string

  @Column({ nullable: true })
  language?: string

  @Index()
  @Column({ nullable: true })
  lastEpisodePubDate?: Date

  @Column({ nullable: true })
  lastEpisodeTitle?: string

  @Column({ nullable: true })
  lastFoundInPodcastIndex?: Date

  @Index()
  @Column({
    type: 'enum',
    enum: ['pending', 'live', 'ended', 'none'],
    default: 'none'
  })
  latestLiveItemStatus: LiveItemStatus

  @ValidateIf((a) => a.linkUrl != null)
  @IsUrl()
  @Column({ nullable: true })
  linkUrl?: string

  @Index()
  @Column({
    type: 'enum',
    enum: ['podcast', 'music', 'video', 'film', 'audiobook', 'newsletter', 'blog', 'music-video'],
    default: 'podcast'
  })
  medium: PodcastMedium

  @Column({ default: false })
  parsingPriority?: boolean

  @Index()
  @ValidateIf((a) => a.pastAllTimeTotalUniquePageviews != null)
  @IsInt()
  @Min(0)
  @Column({ default: 0 })
  pastAllTimeTotalUniquePageviews: number

  @Index()
  @ValidateIf((a) => a.pastHourTotalUniquePageviews != null)
  @IsInt()
  @Min(0)
  @Column({ default: 0 })
  pastHourTotalUniquePageviews: number

  @Index()
  @ValidateIf((a) => a.pastDayTotalUniquePageviews != null)
  @IsInt()
  @Min(0)
  @Column({ default: 0 })
  pastDayTotalUniquePageviews: number

  @Index()
  @ValidateIf((a) => a.pastWeekTotalUniquePageviews != null)
  @IsInt()
  @Min(0)
  @Column({ default: 0 })
  pastWeekTotalUniquePageviews: number

  @Index()
  @ValidateIf((a) => a.pastMonthTotalUniquePageviews != null)
  @IsInt()
  @Min(0)
  @Column({ default: 0 })
  pastMonthTotalUniquePageviews: number

  @Index()
  @ValidateIf((a) => a.pastYearTotalUniquePageviews != null)
  @IsInt()
  @Min(0)
  @Column({ default: 0 })
  pastYearTotalUniquePageviews: number

  @ValidateIf((a) => a.shrunkImageUrl != null)
  @IsUrl()
  @Column({ nullable: true })
  shrunkImageUrl?: string

  @Index()
  @Column({ nullable: true })
  shrunkImageLastUpdated?: Date

  @Index()
  @Column({ nullable: true })
  sortableTitle?: string

  @Column({ nullable: true })
  subtitle?: string

  @Index()
  @Column({ nullable: true })
  title?: string

  @Column({ nullable: true })
  type?: string

  @Column('simple-json', { nullable: true })
  value: Value[]

  @ManyToMany((type) => Author, (author) => author.podcasts)
  @JoinTable()
  authors: Author[]

  @ManyToMany((type) => Category, (category) => category.podcasts)
  @JoinTable()
  categories: Category[]

  @OneToMany((type) => Episode, (episode) => episode.podcast)
  episodes: Episode[]

  @OneToMany((type) => FeedUrl, (feedUrl) => feedUrl.podcast)
  feedUrls: FeedUrl[]

  @OneToMany((type) => Notification, (notification) => notification.podcast)
  notifications: Notification[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @BeforeInsert()
  beforeInsert() {
    this.id = generateShortId()
  }

  @BeforeInsert()
  @BeforeUpdate()
  beforeAll() {
    if (this.description) {
      this.description = this.description.trim() === '' ? undefined : this.description.trim()
    }
    if (this.guid) {
      this.guid = this.guid.trim() === '' ? undefined : this.guid.trim()
    }
    if (this.title) {
      this.title = this.title.trim() === '' ? undefined : this.title.trim()
    }
  }
}
