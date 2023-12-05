import type { InitializedOperationData } from '../BrushStrategy';

/**
 * Sets up a preview to erase/clear the segment values.
 */
export default {
  createInitialized: (enabled, operationData: InitializedOperationData) => {
    operationData.segmentIndex = 0;
  },
};