import { NIM_PROXY_URL } from './constants';

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
    const blob = await response.blob();
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      $('#output_mask').attr('src', reader.result);
      $('#resultInfo').show();
      $('#input_image').hide();
      $('#output_mask').show();

      const count = JSON.parse(
        response.headers.get('MONAI-SVC-OUTPUT-PROPERTIES')
      ).contours;
      $('#polycount').text(count);
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
