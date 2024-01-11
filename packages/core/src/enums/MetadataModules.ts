/**
 * Contains the names for the metadata modules.
 * Recommendation is to add all module names here rather than having them
 * just use string names.
 * The naming convention is that the enum has the modules in it, so the
 * enum key does not repeat the Modules, but the enum value does (to agree
 * with existing naming conventions)
 */
enum MetadataModules {
  CINE = 'cineModule',
  IMAGE_URL = 'imageUrlModule',
  SOP_COMMON = 'sopCommonModule',
  VOI_LUT = 'voiLutModule',
  MODALITY_LUT = 'modalityLutModule',
  GENERAL_SERIES = 'generalSeriesModule',
  PATIENT_STUDY = 'patientStudyModule',
  NM_MULTIFRAME_GEOMETRY = 'nmMultiframeGeometryModule',
  IMAGE_PLANE = 'imagePlaneModule',
  IMAGE_PIXEL = 'imagePixelModule',
  MULTIFRAME = 'multiframeModule',
  ULTRASOUND_ENHANCED_REGION = 'ultrasoundEnhancedRegionModule',
  CALIBRATION = 'calibrationModule',
}

export default MetadataModules;
