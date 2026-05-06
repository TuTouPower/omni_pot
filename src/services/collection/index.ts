import type { CollectionService } from '@shared/types/collection_service'
import { anki_service } from './anki'
import { eudic_service } from './eudic'

export const collectionServices: CollectionService[] = [anki_service, eudic_service]
