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
import MyProbeTool from './ProbeTool';

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

const toolsArray = [
  SegmentationDisplayTool,
  StackScrollMouseWheelTool,
  MyProbeTool,
];

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

export function clearAnnotations(renderingEngine) {
  cornerstoneTools.annotation.state
    .getAnnotationManager()
    .removeAllAnnotations();
  renderingEngine?.render();
}

export function saveAnnotations() {
  const manager = cornerstoneTools.annotation.state.getAnnotationManager();
  const a = manager.saveAnnotations(null, MyProbeTool.toolName);
  console.log('Save Annotations', a);
  return a;
}

export function restoreAnnotations(annotations, renderingEngine) {
  console.log('Restore Annotations', annotations);

  if (
    !annotations ||
    !Object.keys(annotations) ||
    Object.keys(annotations).length === 0
  ) {
    clearAnnotations(renderingEngine);
    return;
  }

  const manager = cornerstoneTools.annotation.state.getAnnotationManager();
  manager.restoreAnnotations(annotations, null, MyProbeTool.toolName);
  renderingEngine?.render();
}

export function setProbeTool(label) {
  const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
  if (label === '') {
    toolGroup.setToolDisabled(MyProbeTool.toolName);
    toolGroup._setCursorForViewports('auto');
    console.log('Probe Tool is reset');
    return;
  }

  const toolName = toolGroup.getActivePrimaryMouseButtonTool();
  if (!toolName || toolName !== MyProbeTool.toolName) {
    toolGroup.setToolEnabled(MyProbeTool.toolName);
    toolGroup.setToolActive(MyProbeTool.toolName, {
      bindings: [
        { mouseButton: csToolsEnums.MouseBindings.Primary },
        { mouseButton: csToolsEnums.MouseBindings.Secondary },
      ],
    });
    console.log('Probe Tool is Active');
  }
}

export function setProbeToolColor(idx) {
  const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
  const toolInstance = toolGroup.getToolInstance(MyProbeTool.toolName);
  const c = getSegmentColor(idx);
  toolInstance.configuration.customColor = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function getClickPoints(ctVolume, annotations, clickType) {
  const points = [];
  if (annotations && Object.keys(annotations).length > 0) {
    const { worldToIndex } = ctVolume.imageData;
    for (const uid in annotations) {
      const anns = annotations[uid][MyProbeTool.toolName];
      for (const a of anns) {
        if (a.data.mouseButton === clickType) {
          const pt = a.data.handles.points[0];
          points.push(worldToIndex(pt).map(Math.round));
        }
      }
    }
  }

  console.log('Point Prompts', points, Object.keys(points).length);
  return points;
}

export async function fillVolumeSegmentationWithLabelData(response, class_idx) {
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
      if (
        class_idx == 0 ||
        scalarData[i] === class_idx ||
        nrrdfile.data[i] === class_idx
      ) {
        scalarData[i] = nrrdfile.data[i];
      }
    }

    triggerEvent(eventTarget, csToolsEnums.Events.SEGMENTATION_DATA_MODIFIED, {
      segmentationId: segmentationId,
    });
  } catch (error) {
    console.log(error);
    alert('Error while rendering Segmentation\n' + error);
  }
}

export function getSegmentColor(idx) {
  return segmentation.state.getColorLUT(0)[idx];
}

export function removeSegment(idx) {
  const vol = cornerstone.cache.getVolume(segmentationId);
  const scalarData = vol.scalarData;

  for (let i = 0; i < scalarData.length; i++) {
    if (scalarData[i] === idx) {
      scalarData[i] = 0;
    }
  }
  triggerEvent(eventTarget, csToolsEnums.Events.SEGMENTATION_DATA_MODIFIED, {
    segmentationId: segmentationId,
  });
}
