import { NIM_PROXY_URL } from './constants';
import jsZip from 'jszip';

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
  console.log('Init...');
  $('#runNIM').prop('disabled', false);
}

async function onRunNIM() {
  $('#runNIM').prop('disabled', true);
  $('#runStatus').show();

  document.body.style.cursor = 'wait';
  const response = await fetchSeg();
  if (response.status == 200) {
    const contentType = response.headers.get('content-type')?.toLowerCase();
    let blob = null;
    if (contentType === 'application/zip') {
      const data = await response.arrayBuffer();
      const zip = await jsZip.loadAsync(data);
      console.log(zip.files);

      const targetFiles = zip.filter((f) => {
        return f.endsWith('.png') || Object.keys(zip.files).length < 2;
      });
      blob = await Object.values(targetFiles)[0].async('blob');
    } else {
      blob = await response.blob();
    }

    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      $('#output_mask').attr('src', reader.result);
      $('#output_mask').show();
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
  $('#runStatus').hide();
}

async function fetchSeg() {
  const nimsURI = $('#nimsURI').val().toString();
  const authHeader = $('#nimsAuthHeader').val().toString();

  const model = $('#model').val().toString();
  const seed = parseInt($('#seed').val().toString());
  const image_count = parseInt($('#image_count').val().toString());
  const rotate = parseFloat($('#rotate').val().toString());
  const truncation_psi = parseFloat($('#truncation_psi').val().toString());
  console.log('truncation_psi', truncation_psi, truncation_psi === null);

  const nimReqData = {
    model: model,
    image_count: isNaN(image_count) ? 1 : image_count,
    seed: isNaN(seed) ? null : seed,
    truncation_psi: isNaN(truncation_psi) ? 1.0 : truncation_psi,
    translate: [0.0, 0.0],
    rotate: isNaN(rotate) ? 0.0 : rotate,
    class_idx: null,
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
