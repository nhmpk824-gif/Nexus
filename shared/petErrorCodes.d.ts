export declare const PET_IPC_ERROR_CODES: {
  readonly ALREADY_IMPORTED: 'NEXUS_ERR_PET_ALREADY_IMPORTED'
  readonly IMPORT_INCOMPLETE: 'NEXUS_ERR_PET_IMPORT_INCOMPLETE'
  readonly UNSUPPORTED_FILE: 'NEXUS_ERR_PET_UNSUPPORTED_FILE'
  readonly GALLERY_INPUT: 'NEXUS_ERR_PET_GALLERY_INPUT'
  readonly GALLERY_FAILED: 'NEXUS_ERR_PET_GALLERY_FAILED'
  readonly KIT_PATH: 'NEXUS_ERR_PET_KIT_PATH'
  readonly NETWORK: 'NEXUS_ERR_PET_NETWORK'
}

export type PetIpcErrorCode = (typeof PET_IPC_ERROR_CODES)[keyof typeof PET_IPC_ERROR_CODES]

export declare const PET_IMPORT_MESSAGE_KEYS: Readonly<{
  imported: 'settings.pet.success.imported'
  importedFrom: 'settings.pet.success.imported_from'
  sprite: 'settings.pet.success.sprite'
  portrait: 'settings.pet.success.portrait'
  layered: 'settings.pet.success.layered'
  kitCreated: 'settings.pet.success.kit_created'
  kitReady: 'settings.pet.success.kit_ready'
  kitReadyWarn: 'settings.pet.success.kit_ready_warn'
  kitIncomplete: 'settings.pet.success.kit_incomplete'
  assembled: 'settings.pet.success.assembled'
  kitInstalled: 'settings.pet.success.kit_installed'
  kitOpenedDir: 'settings.pet.success.kit_opened_dir'
  kitOpenedFile: 'settings.pet.success.kit_opened_file'
  actionImage: 'settings.pet.success.action.image'
  actionPortrait: 'settings.pet.success.action.portrait'
  actionLayered: 'settings.pet.success.action.layered'
  actionAtlas: 'settings.pet.success.action.atlas'
  actionAtlasNative: 'settings.pet.success.action.atlas_native'
  auditOk: 'settings.pet.success.audit.ok'
  auditWarn: 'settings.pet.success.audit.warn'
  sourceCommunityZip: 'settings.pet.success.source.community_zip'
}>

export type PetImportMessageKey =
  (typeof PET_IMPORT_MESSAGE_KEYS)[keyof typeof PET_IMPORT_MESSAGE_KEYS]

export declare function buildPetIpcError(
  code: PetIpcErrorCode,
  options?: { cause?: unknown },
): Error

export declare function extractPetIpcErrorCode(error: unknown): PetIpcErrorCode | null
