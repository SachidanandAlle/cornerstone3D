import * as cornerstone from '@cornerstonejs/core';
import {
  cache as cornerstoneCache,
  Enums,
  eventTarget,
  init as csInit,
  RenderingEngine,
  setUseSharedArrayBuffer,
  setVolumesForViewports,
  triggerEvent,
  volumeLoader,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  cornerstoneNiftiImageVolumeLoader,
  Enums as NiftiEnums,
} from '@cornerstonejs/nifti-volume-loader';

import { setCtTransferFunctionForVolumeActor } from '../../../../utils/demo/helpers';
import * as nrrdjs from '@jonathanlurie/nrrdjs';
import jsZip from 'jszip';

import * as nifti from 'nifti-reader-js';

const {
  SegmentationDisplayTool,
  ToolGroupManager,
  StackScrollMouseWheelTool,
  Enums: csToolsEnums,
  init: csTools3dInit,
  segmentation,
} = cornerstoneTools;

const toolGroupId = 'STACK_TOOL_GROUP_ID';
const viewportId1 = 'CT_NIFTI_AXIAL';
const viewportId2 = 'CT_NIFTI_SAGITTAL';
const viewportId3 = 'CT_NIFTI_CORONAL';
const segmentationId = 'SEG_NIFTI_ID';
const renderingEngineId = 'myRenderingEngine';

const toolsArray = [SegmentationDisplayTool, StackScrollMouseWheelTool];

const addSegmentationsToState = async (volumeId: string) => {
  const segmentationForView =
    segmentation.state.getSegmentation(segmentationId);
  const segmentationVolume = cornerstoneCache.getVolume(segmentationId);
  if (!segmentationForView && !segmentationVolume) {
    await volumeLoader.createAndCacheDerivedSegmentationVolume(volumeId, {
      volumeId: segmentationId,
    });
    segmentation.addSegmentations([
      {
        segmentationId: segmentationId,
        representation: {
          type: csToolsEnums.SegmentationRepresentations.Labelmap,
          data: {
            volumeId: segmentationId,
          },
        },
      },
    ]);
    await segmentation.addSegmentationRepresentations(toolGroupId, [
      {
        segmentationId: segmentationId,
        type: csToolsEnums.SegmentationRepresentations.Labelmap,
      },
    ]);
  }
};

export function resetImage(renderingEngine) {
  segmentation.state.removeSegmentation(segmentationId);
  for (const tool of toolsArray) {
    cornerstoneTools.removeTool(tool);
  }
  ToolGroupManager.destroyToolGroup(toolGroupId);
  renderingEngine?.destroy();
  cornerstoneCache.purgeCache();
}

export async function renderImage(volumeId, updateProgress) {
  setUseSharedArrayBuffer(false);
  await csInit();
  await csTools3dInit();
  volumeLoader.registerVolumeLoader('nifti', cornerstoneNiftiImageVolumeLoader);

  const renderingEngine = new RenderingEngine(renderingEngineId);
  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
  for (const tool of toolsArray) {
    cornerstoneTools.addTool(tool);
    toolGroup.addTool(tool.toolName);
    toolGroup.setToolEnabled(tool.toolName);
    toolGroup.setToolActive(tool.toolName);
  }

  const viewportInputArray = [
    {
      viewportId: viewportId1,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: <HTMLDivElement>document.getElementById('element1'),
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: viewportId2,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: <HTMLDivElement>document.getElementById('element2'),
      defaultOptions: {
        orientation: Enums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: viewportId3,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element: <HTMLDivElement>document.getElementById('element3'),
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
      },
    },
  ];
  renderingEngine.setViewports(viewportInputArray);
  toolGroup.addViewport(viewportId1, renderingEngineId);
  toolGroup.addViewport(viewportId2, renderingEngineId);
  toolGroup.addViewport(viewportId3, renderingEngineId);

  eventTarget.addEventListener(
    NiftiEnums.Events.NIFTI_VOLUME_PROGRESS,
    updateProgress
  );

  try {
    const ctVolume = await volumeLoader.createAndCacheVolume(volumeId);
    await addSegmentationsToState(volumeId);

    setVolumesForViewports(
      renderingEngine,
      [{ volumeId, callback: setCtTransferFunctionForVolumeActor }],
      viewportInputArray.map((v) => v.viewportId)
    );

    renderingEngine.render();
    return { renderingEngine: renderingEngine, ctVolume: ctVolume };
  } catch (error) {
    alert(
      'Failed to load Image from remote.\nCheck if it is a valid URI and accessible'
    );
    resetImage(renderingEngine);
  }
  return { renderingEngine: null, ctVolume: null };
}

export async function fillVolumeSegmentationWithLabelData(response) {
  try {
    const vol = cornerstone.cache.getVolume(segmentationId);
    const scalarData = vol.scalarData;

    let nrrdfile;
    const data = await response.arrayBuffer();
    const contentType = response.headers.get('content-type')?.toLowerCase();

    console.log('Response Content Type', contentType);
    if (contentType === 'application/zip') {
      const zip = await jsZip.loadAsync(data);
      const fileData = await Object.values(zip.files)[0].async('arraybuffer');
      nrrdfile = nrrdjs.parse(fileData);
    } else {
      nrrdfile = nrrdjs.parse(data);
    }

    for (let i = 0; i < scalarData.length; i++) {
      scalarData[i] = nrrdfile.data[i];
    }

    triggerEvent(eventTarget, csToolsEnums.Events.SEGMENTATION_DATA_MODIFIED, {
      segmentationId: segmentationId,
    });
  } catch (error) {
    console.log(error);
    alert('Error while rendering Segmentation\n' + error);
  }
}
