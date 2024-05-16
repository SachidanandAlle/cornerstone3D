import {
  RenderingEngine,
  Enums,
  init as csInit,
  volumeLoader,
  setVolumesForViewports,
  eventTarget,
  setUseSharedArrayBuffer,
  triggerEvent,
  cache as cornerstoneCache,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  cornerstoneNiftiImageVolumeLoader,
  Enums as NiftiEnums,
} from '@cornerstonejs/nifti-volume-loader';

import * as cornerstone from '@cornerstonejs/core';
import * as nrrdjs from '@jonathanlurie/nrrdjs';

import { setCtTransferFunctionForVolumeActor } from '../../../../utils/demo/helpers';
import ProbeMONAITool from './ProbeTool';
import { NIM_PROXY_URL, VISTA_LABELS } from './constants';
import jsZip from 'jszip';

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
const labelToClickPoints = new Map();
let currnetLabelForClickPoints = '';
const autoRunLabels = new Map();

const renderingEngineId = 'myRenderingEngine';
let renderingEngine;
let ctVolume;

const viewportInputArray = [
  {
    viewportId: viewportId1,
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: document.getElementById('element1'),
    defaultOptions: {
      orientation: Enums.OrientationAxis.AXIAL,
    },
  },
  {
    viewportId: viewportId2,
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: document.getElementById('element2'),
    defaultOptions: {
      orientation: Enums.OrientationAxis.SAGITTAL,
    },
  },
  {
    viewportId: viewportId3,
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: document.getElementById('element3'),
    defaultOptions: {
      orientation: Enums.OrientationAxis.CORONAL,
    },
  },
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

function reset() {
  cornerstoneCache.purgeCache();
  renderingEngine?.destroy();
  segmentation.state.removeSegmentation(segmentationId);
  ToolGroupManager.destroyToolGroup(toolGroupId);
  renderingEngine = null;
}

document.getElementById('runNIM').onclick = async () => {
  await onRunNIM();
};

async function onRunNIM() {
  document.getElementById('runNIM').disabled = true;
  await fillVolumeSegmentationWithLabelData();
  document.getElementById('runNIM').disabled = false;
}

document.getElementById('loadImage').onclick = async () => {
  reset();
  await setup();
};

document.getElementById('clickPrompts').onchange = async () => {
  await onSelectClickLabel();
};

document.getElementById('clearClicks').onclick = async () => {
  const label = document.getElementById('clickPrompts').value;
  if (label === '') {
    return;
  }

  console.log('clear click points for', label);
  labelToClickPoints.delete(label);
  cornerstoneTools.annotation.state
    .getAnnotationManager()
    .removeAllAnnotations();
  renderingEngine?.render();
};

document.getElementById('clearAllClicks').onclick = async () => {
  console.log('clear all click points...');
  cornerstoneTools.annotation.state
    .getAnnotationManager()
    .removeAllAnnotations();

  labelToClickPoints.clear();
  document.getElementById('clickPrompts').selectedIndex = 0;
  await onSelectClickLabel();
};

async function onSelectClickLabel() {
  const label = document.getElementById('clickPrompts').value;
  console.log('You selected: ', label);
  console.log('Status: ', currnetLabelForClickPoints, labelToClickPoints);

  document.getElementById('clearClicks').style.color =
    label === '' ? 'gray' : 'darkgreen';

  document.getElementById('runNIM').disabled = label === '';

  const manager = cornerstoneTools.annotation.state.getAnnotationManager();
  if (label === currnetLabelForClickPoints) {
    console.log('Current and prev same', label, currnetLabelForClickPoints);
    return;
  } else {
    const annotations = manager.saveAnnotations(null, 'ProbeMONAITool');
    labelToClickPoints[currnetLabelForClickPoints] = annotations;
    cornerstoneTools.annotation.state
      .getAnnotationManager()
      .removeAllAnnotations();
    renderingEngine?.render();
    console.log(
      'Saving prev annotations for',
      currnetLabelForClickPoints,
      annotations
    );
  }

  currnetLabelForClickPoints = label;
  const annotations = labelToClickPoints[label];
  if (annotations) {
    console.log('Restoring previous annotations for', label, annotations);
    manager.restoreAnnotations(annotations, null, 'ProbeMONAITool');
    renderingEngine?.render();
  } else {
    // console.log('No prev annotations found for', label);
    // if (document.getElementById('autoRunChecked').checked) {
    if (!autoRunLabels.has(label)) {
      autoRunLabels.set(label, true);
      await onRunNIM();
    }
  }

  const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
  if (label === '') {
    // toolGroup.setToolActive(StackScrollMouseWheelTool.toolName, {
    //   bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
    // });
    toolGroup.setToolDisabled(ProbeMONAITool.toolName);
    console.log('ProbeMONAITool is reset');
    return;
  }

  const toolName = toolGroup.getActivePrimaryMouseButtonTool();
  if (!toolName || toolName !== ProbeMONAITool.toolName) {
    toolGroup.setToolEnabled(ProbeMONAITool.toolName);
    toolGroup.setToolActive(ProbeMONAITool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
    });
    console.log('ProbeMONAITool is Active');
  }
}

async function setup() {
  document.getElementById('runNIM').disabled = true;
  setUseSharedArrayBuffer(false);
  await csInit();
  await csTools3dInit();

  volumeLoader.registerVolumeLoader('nifti', cornerstoneNiftiImageVolumeLoader);

  const niftiURL = document.getElementById('imageURI').value;
  console.log('Using Image URI', niftiURL);
  const volumeId = 'nifti:' + niftiURL;

  // Add tools to Cornerstone3D
  cornerstoneTools.removeTool(SegmentationDisplayTool);
  cornerstoneTools.removeTool(StackScrollMouseWheelTool);
  cornerstoneTools.removeTool(ProbeMONAITool);
  cornerstoneTools.addTool(StackScrollMouseWheelTool);
  cornerstoneTools.addTool(SegmentationDisplayTool);
  cornerstoneTools.addTool(ProbeMONAITool);

  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
  toolGroup.addTool(SegmentationDisplayTool.toolName);
  toolGroup.setToolEnabled(SegmentationDisplayTool.toolName);
  toolGroup.addTool(StackScrollMouseWheelTool.toolName);
  toolGroup.setToolActive(StackScrollMouseWheelTool.toolName);
  toolGroup.addTool(ProbeMONAITool.toolName);
  toolGroup.setToolActive(ProbeMONAITool.toolName);

  renderingEngine = new RenderingEngine(renderingEngineId);
  renderingEngine.setViewports(viewportInputArray);
  toolGroup.addViewport(viewportId1, renderingEngineId);
  toolGroup.addViewport(viewportId2, renderingEngineId);
  toolGroup.addViewport(viewportId3, renderingEngineId);

  eventTarget.addEventListener(
    NiftiEnums.Events.NIFTI_VOLUME_PROGRESS,
    updateProgress
  );

  try {
    ctVolume = await volumeLoader.createAndCacheVolume(volumeId);
    await addSegmentationsToState(volumeId);

    setVolumesForViewports(
      renderingEngine,
      [{ volumeId, callback: setCtTransferFunctionForVolumeActor }],
      viewportInputArray.map((v) => v.viewportId)
    );

    renderingEngine.render();
  } catch (error) {
    alert(
      'Failed to load Image from remote.\nCheck if it is a valid URI and accessible'
    );
    reset();
  }
}

const updateProgress = (evt) => {
  const { data } = evt.detail;
  if (!data) {
    return;
  }

  const { total, loaded } = data;
  if (!total) {
    return;
  }

  const progress = Math.round((loaded / total) * 100);
  const element = document.querySelector('progress');
  element.value = progress;

  if (progress >= 100) {
    document.getElementById('l_element1').innerText = 'Axial';
    document.getElementById('l_element2').innerText = 'Sagittal';
    document.getElementById('l_element3').innerText = 'Coronal';
  }
  document.getElementById('loadImage').disabled = progress < 100;
};

function getClickPoints() {
  const manager = cornerstoneTools.annotation.state.getAnnotationManager();
  const annotations = manager.saveAnnotations(null, 'ProbeMONAITool');
  labelToClickPoints[currnetLabelForClickPoints] = annotations;

  const { worldToIndex } = ctVolume.imageData;
  const points = {};

  const label = currnetLabelForClickPoints;
  for (const uid in labelToClickPoints[label]) {
    const annotations = labelToClickPoints[label][uid]['ProbeMONAI'];
    console.log(annotations);

    points[label] = [];
    for (const annotation of annotations) {
      const pt = annotation.data.handles.points[0];
      points[label].push(worldToIndex(pt).map(Math.round));
    }
  }

  console.log('Point Prompts', points, Object.keys(points).length);
  return points;
}

async function fillVolumeSegmentationWithLabelData() {
  const segmentationVolume = cornerstone.cache.getVolume(segmentationId);
  const scalarData = segmentationVolume.scalarData;
  const imageURI = document.getElementById('imageURI').value;
  const nimsURI = document.getElementById('nimsURI').value;
  const authHeader = document.getElementById('nimsAuthHeader').value;
  const classPrompts = [];

  const pointPrompts = getClickPoints();
  const nimReqData = {
    image: imageURI,
    prompts: {},
  };

  const usingPointPrompts = Object.keys(pointPrompts).length > 0;
  const current_class_id =
    currnetLabelForClickPoints !== ''
      ? parseInt(
          Object.keys(VISTA_LABELS).find(
            (key) => VISTA_LABELS[key] === currnetLabelForClickPoints
          )
        )
      : 0;
  if (!usingPointPrompts) {
    classPrompts.push(currnetLabelForClickPoints);
  }

  if (usingPointPrompts) {
    nimReqData.prompts['points'] = pointPrompts;
  } else {
    nimReqData.prompts['classes'] = classPrompts;
  }
  console.log('nimReqData', nimReqData, usingPointPrompts, current_class_id);

  document.body.style.cursor = 'wait';

  const response = await fetch(NIM_PROXY_URL + nimsURI, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nimReqData),
  });

  if (response.status == 200) {
    try {
      let nrrdfile;
      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type')?.toLowerCase();

      console.log('Response Content Type', contentType);
      if (
        nimsURI ===
          'https://health.api.nvidia.com/v1/medicalimaging/nvidia/vista-3d' ||
        contentType === 'application/zip'
      ) {
        const zip = await jsZip.loadAsync(data);
        const fileData = await Object.values(zip.files)[0].async('arraybuffer');
        nrrdfile = nrrdjs.parse(fileData);
      } else {
        nrrdfile = nrrdjs.parse(data);
      }

      for (let i = 0; i < scalarData.length; i++) {
        if (
          scalarData[i] === current_class_id ||
          nrrdfile.data[i] === current_class_id
        ) {
          scalarData[i] = nrrdfile.data[i];
        }
      }

      triggerEvent(
        eventTarget,
        csToolsEnums.Events.SEGMENTATION_DATA_MODIFIED,
        {
          segmentationId: segmentationId,
        }
      );
    } catch (error) {
      console.log(error);
      alert('Not a valid response from NIM\n' + error);
    }
  } else {
    if (response.status == 401) {
      alert(
        'Unauthorized to make NIM Request.\nCheck if valid API Key/Token is correctly set in Auth Header.'
      );
    } else {
      alert(
        'Error Response: \n' +
          '    Status Code: ' +
          response.status +
          '\n' +
          '    Status Text: ' +
          response.statusText +
          '\n' +
          '    Response Body: ' +
          (await response.text()) +
          '\n'
      );
    }
  }
  document.body.style.cursor = 'default';

  let annotatedLabelsHeader = '';
  let annotatedLabels = '';
  for (const [key, value] of autoRunLabels.entries()) {
    if (value) {
      annotatedLabels += '<span class="labeltag">' + key + '</span>';
      annotatedLabelsHeader =
        '<label class="labelhead">Annotated labels</label><br/>';
    }
  }
  document.getElementById('annotatedLabels').innerHTML =
    annotatedLabelsHeader + annotatedLabels;
}

setup();
