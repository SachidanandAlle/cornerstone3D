import { ANATOMY_LIST, BODY_REGION, NIM_PROXY_URL } from './constants';
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

    document.getElementById('runNIM').onclick = async () => {
      await onRunNIM();
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
  s1.setValue('chest');
  s2.setValue('liver');
  $('#runNIM').prop('disabled', false);
}

async function onRunNIM() {
  $('#runNIM').prop('disabled', true);
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
  const nimsURI = $('#nimsURI').val().toString();
  const authHeader = $('#nimsAuthHeader').val().toString();

  const body_region = $('#bodyRegion').val().toString();
  const anatomy_list = $('#anatomyList').val().toString();
  const output_size = parseInt($('#dimensions').val().toString());
  const spacing = parseFloat($('#spacing').val().toString());

  const nimReqData = {
    num_output_samples: 1,
    body_region: [body_region],
    anatomy_list: [anatomy_list],
    output_size: [output_size, output_size, output_size],
    spacing: [spacing, spacing, spacing],
    output: { url: '/results/' },
  };

  console.log('nimReqData', nimReqData);

  const r = await fetch(NIM_PROXY_URL + nimsURI, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(nimReqData),
  });

  const output = await r.json();
  // const output = {
  //   url: [
  //     '/results/output_q4wyiwgw/sample_20240624_055321_image.nii.gz',
  //     '/results/output_q4wyiwgw/sample_20240624_055321_label.nrrd',
  //   ],
  // };

  const s = (NIM_PROXY_URL + nimsURI).split('/');
  const url1 =
    (nimsURI.startsWith('http') ? s[0] + '//' + s[2] : '') + output['url'][0];
  const url2 =
    (nimsURI.startsWith('http') ? s[0] + '//' + s[2] : '') + output['url'][1];

  const niftiURL = url1.endsWith('.nii.gz') ? url1 : url2;
  console.log('Using Image URI', niftiURL);
  const volumeId = 'nifti:' + niftiURL;
  cornerStoneImage = await renderImage(volumeId, updateProgress);

  const maskURI = url2.endsWith('.nrrd') ? url2 : url1;
  console.log('Using Mask URI', maskURI);
  return await fetch(maskURI);
}

setup();
