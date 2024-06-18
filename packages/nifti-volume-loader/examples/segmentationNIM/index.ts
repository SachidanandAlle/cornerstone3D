import { NIM_PROXY_URL } from './constants';
import {
  fillVolumeSegmentationWithLabelData,
  renderImage,
  resetImage,
} from './segutils';

let cornerStoneImage = null;

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
    $('#title_element1').text('Axial');
    $('#title_element2').text('Sagittal');
    $('#title_element3').text('Coronal');
  }

  $('#loadImage').prop('disabled', progress < 100);
  $('#runNIM').prop('disabled', progress < 100);
};

function setup() {
  $(document).ready(async function () {
    console.log('Document Ready...');
    onInit();

    document.getElementById('loadImage').onclick = async () => {
      onReset();
      await onInit();
    };

    document.getElementById('runNIM').onclick = async () => {
      await onRunNIM();
    };
  });
}

function onReset() {
  console.log('Reset...');
}

async function onInit() {
  resetImage(cornerStoneImage?.renderingEngine);

  const niftiURL = $('#imageURI').val().toString();
  console.log('Using Image URI', niftiURL);
  const volumeId = 'nifti:' + niftiURL;
  cornerStoneImage = await renderImage(volumeId, updateProgress);
}

async function onRunNIM() {
  $('#runNIM').prop('disabled', true);
  $('#imageURI').prop('readOnly', true);
  $('#loadImage').prop('disabled', true);
  $('#runNIM').prop('disabled', true);
  $('#runStatus').show();

  document.body.style.cursor = 'wait';
  const response = await fetchSeg();
  if (response.status == 200) {
    await fillVolumeSegmentationWithLabelData(response);
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
  $('#imageURI').prop('readOnly', false);
  $('#loadImage').prop('disabled', false);
  $('#runNIM').prop('disabled', false);
  $('#runStatus').hide();
}

async function fetchSeg() {
  const imageURI = $('#imageURI').val().toString();
  const nimsURI = $('#nimsURI').val().toString();
  const authHeader = $('#nimsAuthHeader').val().toString();
  const params = JSON.parse($('#params').val().toString());

  console.log(cornerStoneImage);

  const nimReqData = {
    image: imageURI,
    prompts: {},
    params: params,
  };

  console.log('nimReqData', nimReqData);

  return await fetch(NIM_PROXY_URL + nimsURI, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nimReqData),
  });
}

setup();
