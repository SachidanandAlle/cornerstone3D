import {
  RenderingEngine,
  Types,
  Enums,
  getRenderingEngine,
} from '@cornerstonejs/core';
import {
  initDemo,
  setTitleAndDescription,
  addButtonToToolbar,
  createImageIdsAndCacheMetaData,
  getLocalUrl,
} from '../../../../utils/demo/helpers';

// This is for debugging purposes
console.warn(
  'Click on index.ts to open source code for this example --------->'
);

const { ViewportType, Events } = Enums;

// ======== Constants ======= //
const renderingEngineId = 'myRenderingEngine';
const viewportId = 'videoViewport';

// ======== Set up page ======== //
setTitleAndDescription(
  'WSI - Whole Slide Imaging Viewport',
  'Demonstrates viewing of whole slide imaging data'
);

const content = document.getElementById('content');
const element = document.createElement('div');
element.id = 'cornerstone-element';
element.style.width = '500px';
element.style.height = '500px';

content.appendChild(element);

const info = document.createElement('div');
content.appendChild(info);

const rotationInfo = document.createElement('div');
info.appendChild(rotationInfo);

const flipHorizontalInfo = document.createElement('div');
info.appendChild(flipHorizontalInfo);

const flipVerticalInfo = document.createElement('div');
info.appendChild(flipVerticalInfo);

element.addEventListener(Events.CAMERA_MODIFIED, (_) => {
  // Get the rendering engine
  const renderingEngine = getRenderingEngine(renderingEngineId);

  // Get the stack viewport
  const viewport = <Types.IStackViewport>(
    renderingEngine.getViewport(viewportId)
  );

  if (!viewport) {
    return;
  }

  const { flipHorizontal, flipVertical } = viewport.getCamera();
  const { rotation } = viewport.getProperties();

  rotationInfo.innerText = `Rotation: ${Math.round(rotation)}`;
  flipHorizontalInfo.innerText = `Flip horizontal: ${flipHorizontal}`;
  flipVerticalInfo.innerText = `Flip vertical: ${flipVertical}`;
});

/**
 * Runs the demo
 */
async function run() {
  // Init Cornerstone and related libraries
  await initDemo();

  // Get Cornerstone imageIds and fetch metadata into RAM
  const imageIds = await createImageIdsAndCacheMetaData({
    StudyInstanceUID: '1.2.276.1.74.1.2.132733202464108492637644434464108492',
    SeriesInstanceUID:
      '2.16.840.1.113883.3.8467.132733202477512857637644434477512857',
    // TODO - deploy the testdata publically
    wadoRsRoot: getLocalUrl() || 'http://localhost:5000/dicomweb',
    convertMultiframe: false,
  });

  // Instantiate a rendering engine
  const renderingEngine = new RenderingEngine(renderingEngineId);

  // Create a stack viewport

  const viewportInput = {
    viewportId,
    type: ViewportType.WSI,
    element,
    defaultOptions: {
      background: <Types.Point3>[0.2, 0, 0.2],
    },
  };

  renderingEngine.enableElement(viewportInput);

  // Get the stack viewport that was created
  const viewport = <Types.IWSIViewport>renderingEngine.getViewport(viewportId);

  // Set the stack on the viewport
  await viewport.setWSI(imageIds);
}

run();