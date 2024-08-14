import { NIM_PROXY_URL } from './constants';
import jsZip from 'jszip';

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

    document.getElementById('toggle_masks').onclick = async () => {
      if (document.getElementById('toggle_masks').checked) {
        $('#input_image').show();
        $('#output_mask').hide();
      } else {
        $('#input_image').hide();
        $('#output_mask').show();
      }
    };
  });
}

function onReset() {
  console.log('Reset...');
  $('#output_mask').attr('src', '');
  $('#resultInfo').hide();
  $('#toggle_masks').prop('checked', false);
}

async function onInit() {
  console.log('Init...');
  const imageURI = $('#imageURI').val().toString();
  $('#input_image').attr('src', imageURI);
  $('#input_image').show();
  $('#runNIM').prop('disabled', false);
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
    const contentType = response.headers.get('content-type')?.toLowerCase();
    let blob = null;
    let contours = 0;
    if (contentType === 'application/zip') {
      const data = await response.arrayBuffer();
      const zip = await jsZip.loadAsync(data);
      console.log(zip.files);

      const targetFiles = zip.filter((f) => {
        return f.endsWith('.png') || Object.keys(zip.files).length < 2;
      });
      const contourFiles = zip.filter((f) => {
        return f.endsWith('contours.json');
      });

      blob = await Object.values(targetFiles)[0].async('blob');
      if (Object.values(contourFiles).length) {
        const obj = JSON.parse(
          await Object.values(contourFiles)[0].async('string')
        );
        console.log('contours', obj);
        contours = obj?.count;
      }
    } else {
      blob = await response.blob();
      contours = JSON.parse(
        response.headers.get('monai-svc-output-properties')
      )?.contours;
    }

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      $('#output_mask').attr('src', reader.result);
      $('#resultInfo').show();
      $('#input_image').hide();
      $('#output_mask').show();

      if (contours) {
        $('#polycount').text(contours);
        $('#masks_info').show();
      } else {
        $('#masks_info').hide();
      }
    };
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

  const nimReqData = {
    image: imageURI,
    prompts: {},
    params: params,
  };

  console.log('nimReqData', nimReqData);
  // return await fetch('http://localhost:9000/img02_seg_all.png');

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
