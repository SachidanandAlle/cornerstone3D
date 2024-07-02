import { ANATOMY_LIST, BODY_REGION, NIM_PROXY_URL } from './constants';
import {
  fillVolumeSegmentationFromBuffer,
  renderImage,
  resetImage,
  toggleMask,
} from './segutils';
import jsZip from 'jszip';

let cornerStoneImage = null;

const updateProgress = (evt) => {
  $('#title_element1').show();
  $('#title_element2').show();
  $('#title_element3').show();

  const progress = 1000;
  const element = document.querySelector('progress');
  element.value = progress;

  $('#loadImage').prop('disabled', progress < 100);
  $('#runNIM').prop('disabled', progress < 100);
};

function setup() {
  $(document).ready(async function () {
    console.log('Document Ready...');
    onInit();

    document.getElementById('runNIM').onclick = async () => {
      await onRunNIM();
    };

    document.getElementById('toggleMask').onclick = async () => {
      await onToggleMask();
    };
  });
}

function onReset() {
  console.log('Reset...');
}

async function onInit() {
  const s1 = document.getElementById('bodyRegion').selectize;
  BODY_REGION.forEach(function (item, index) {
    s1.addOption({ value: item, text: item });
  });

  const s2 = document.getElementById('anatomyList').selectize;
  ANATOMY_LIST.forEach(function (item, index) {
    s2.addOption({ value: item, text: item });
  });

  resetImage(cornerStoneImage?.renderingEngine);
  s1.setValue('abdomen');
  s2.setValue('liver');
  $('#runNIM').prop('disabled', false);
}

async function onRunNIM() {
  $('#runNIM').prop('disabled', true);
  $('#loadImage').prop('disabled', true);
  $('#runNIM').prop('disabled', true);
  $('#runStatus').show();

  document.body.style.cursor = 'wait';
  resetImage(cornerStoneImage?.renderingEngine);

  const response = await fetchSeg();
  if (response.status == 200) {
    const data = await response.arrayBuffer();
    const zip = await jsZip.loadAsync(data);

    console.log(zip.files);
    const imageFiles = zip.filter((f) => {
      return f.endsWith('.nii.gz');
    });
    const maskFiles = zip.filter((f) => {
      return f.endsWith('.nrrd');
    });

    // Load Image
    window.niftiBuffer = await Object.values(imageFiles)[0].async(
      'arraybuffer'
    );
    const niftiURL = 'http://window.niftiBuffer/' + imageFiles[0].name;
    const volumeId = 'nifti:' + niftiURL;
    cornerStoneImage = await renderImage(volumeId, updateProgress);
    updateProgress(null);
    window.niftiBuffer = null;

    // Load Mask
    const maskData = await Object.values(maskFiles)[0].async('arraybuffer');
    await fillVolumeSegmentationFromBuffer(maskData);
  } else {
    if (response.status == 401) {
      alert(
        'Unauthorized to make Inference Request.\nCheck if valid API Key/Token is correctly set in Auth Header.'
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

  $('#runNIM').prop('disabled', false);
  $('#loadImage').prop('disabled', false);
  $('#runNIM').prop('disabled', false);
  $('#runStatus').hide();
}

async function fetchSeg() {
  const nimsURI = $('#nimsURI').val().toString();
  const authHeader = $('#nimsAuthHeader').val().toString();

  const body_region = document.getElementById('bodyRegion').selectize.items;
  const anatomy_list = document.getElementById('anatomyList').selectize.items;
  const output_size = parseInt($('#dimensions').val().toString());
  const spacing = parseFloat($('#spacing').val().toString());
  const num_inference_steps = parseInt($('#inferenceSteps').val().toString());

  const nimReqData = {
    num_output_samples: 1,
    body_region: body_region,
    anatomy_list: anatomy_list,
    output_size: [output_size, output_size, output_size],
    spacing: [spacing, spacing, spacing],
    num_inference_steps: num_inference_steps ? num_inference_steps : null,
  };

  console.log('nimReqData', nimReqData);

  // return fetch(
  //   'http://localhost:3001/c87b4b84-61fe-4851-b9c3-10dd19534380.zip'
  // );

  return fetch(NIM_PROXY_URL + nimsURI, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'NVCF-POLL-SECONDS': '300',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nimReqData),
  });
}

async function onToggleMask() {
  await toggleMask(document.getElementById('toggleMask').checked);
}

setup();
