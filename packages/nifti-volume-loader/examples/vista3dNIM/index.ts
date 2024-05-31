import { NIM_PROXY_URL, VISTA_LABELS } from './constants';
import {
  clearAnnotations,
  fillVolumeSegmentationWithLabelData,
  getClickPoints,
  getSegmentColor,
  removeSegment,
  renderImage,
  resetImage,
  restoreAnnotations,
  saveAnnotations,
  setProbeTool,
  setProbeToolColor,
} from './segutils';

let cornerStoneImage = null;
let selectedLabel = '';
let autoRunLabels = new Map();

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

    document.getElementById('newLabelLink').onclick = async () => {
      onNewLabelLink();
    };

    document.getElementById('clickPrompts').onchange = async () => {
      await onSelectLabel();
    };

    document.getElementById('clearClicks').onclick = async () => {
      await onClearClicks();
    };

    document.getElementById('clearAllClicks').onclick = async () => {
      await onClearAllClicks();
    };

    document.getElementById('myform').addEventListener('submit', submitForm);
  });
}

function onReset() {
  selectedLabel = '';
  autoRunLabels = new Map();

  document.getElementById('clickPrompts').selectize.setValue('');
  document.getElementById('annotatedTags').innerHTML = '';
  document.getElementById('annotatedTagsHead').style.display = 'none';
}

async function onInit() {
  const selectize = document.getElementById('clickPrompts').selectize;
  for (const key in VISTA_LABELS) {
    selectize.addOption({ value: key, text: VISTA_LABELS[key] });
  }

  resetImage(cornerStoneImage?.renderingEngine);

  const niftiURL = $('#imageURI').val().toString();
  console.log('Using Image URI', niftiURL);
  const volumeId = 'nifti:' + niftiURL;
  cornerStoneImage = await renderImage(volumeId, updateProgress);
}

async function onSelectLabel() {
  const label = $('#clickPrompts').val().toString();
  const class_idx = label && label !== '' ? parseInt(label) : 0;
  console.log('Selected Label', label, class_idx);

  $('#runNIM').prop('disabled', label === '');
  $('#clearClicks').css('color', label === '' ? 'gray' : 'darkgreen');

  if (label === '' || selectedLabel === '') {
    setProbeTool(label);
  }
  setProbeToolColor(class_idx);

  // In case of Tag Delete
  if (selectedLabel === label) {
    return;
  }

  if (label !== '' && !autoRunLabels.has(label)) {
    autoRunLabels.set(label, null);
    if (class_idx < 133) {
      await onRunNIM();
    }
  }

  console.log(autoRunLabels);
  if (selectedLabel !== '') {
    autoRunLabels.set(selectedLabel, saveAnnotations());
  }
  restoreAnnotations(
    autoRunLabels.get(label),
    cornerStoneImage?.renderingEngine
  );
  selectedLabel = label;

  updateLabelTags();
}

function onClearClicks() {
  const label = document.getElementById('clickPrompts').value;
  console.log('clear click points for', label);
  clearAnnotations(cornerStoneImage?.renderingEngine);

  if (label !== '') {
    autoRunLabels.set(label, null);
  }
}

function onClearAllClicks() {
  clearAnnotations(cornerStoneImage?.renderingEngine);
  for (const label of autoRunLabels.keys()) {
    autoRunLabels.set(label, null);
  }
}

function updateLabelTags() {
  console.log('Update Label Tags', autoRunLabels.keys());
  $('#annotatedTagsHead').hide();

  let tags = '';
  const selectize = document.getElementById('clickPrompts').selectize;
  for (const label of autoRunLabels.keys()) {
    const idx = label && label !== '' ? parseInt(label) : 0;
    if (!idx) {
      continue;
    }

    const col = getSegmentColor(idx);
    tags +=
      '<div class="tag_list" style="background-color: rgb(' +
      col[0] +
      ',' +
      col[1] +
      ',' +
      col[2] +
      ')" data-id=\'' +
      label +
      "'>" +
      selectize.getOption(label)[0].innerText +
      '<span>x</span></div>';
  }

  if (tags === '') {
    return;
  }

  $('#annotatedTagsHead').show();
  document.getElementById('annotatedTags').innerHTML = tags;

  $('.tag_list').click(async function () {
    $(this).addClass('tag_list_hide');
    const id = $(this).data('id');
    await onDeleteTag(String(id));
  });
}

async function onDeleteTag(id) {
  console.log(
    'Remove Tag',
    id,
    selectedLabel,
    id == selectedLabel,
    id === selectedLabel
  );

  console.log('Initial: ', autoRunLabels, autoRunLabels.keys(), selectedLabel);
  autoRunLabels.delete(id);
  removeSegment(parseInt(id));

  console.log('After: ', autoRunLabels, autoRunLabels.keys());
  if (id === selectedLabel) {
    clearAnnotations(cornerStoneImage?.renderingEngine);
    selectedLabel = '';
    document.getElementById('clickPrompts').selectize.setValue('');
  }
  console.log('Final: ', autoRunLabels, autoRunLabels.keys());
  if (autoRunLabels.size === 0) {
    $('#annotatedTagsHead').hide();
  }
}

function onNewLabelLink() {
  let html = '';
  const current = Object.keys(
    document.getElementById('clickPrompts').selectize.options
  );
  for (let i = 133; i <= 255; i++) {
    if (!current.includes(String(i))) {
      html += '<option key="' + i + '>' + i + '</option>';
    }
  }
  document.getElementById('inputLabelIndex').innerHTML = html;
  $('#addNewLabelModal').modal('show');
}

function submitForm(e) {
  e.preventDefault();

  const key = $('#inputLabelIndex').find(':selected').val();
  const text = $('#inputLabelName').val();

  const selectize = document.getElementById('clickPrompts').selectize;
  selectize.addOption({ value: key, text: text });
  $('#addNewLabelModal').modal('hide');

  selectize.setValue(key);
}

async function onRunNIM() {
  $('#runNIM').prop('disabled', true);
  $('#imageURI').prop('readOnly', true);
  $('#loadImage').prop('disabled', true);
  $('#runNIM').prop('disabled', true);
  $('#runStatus').show();
  document.getElementById('clickPrompts').selectize.disable();

  const label = $('#clickPrompts').val().toString();
  const class_idx = label && label !== '' ? parseInt(label) : 0;

  document.body.style.cursor = 'wait';
  const response = await fetchSeg();
  if (response.status == 200) {
    await fillVolumeSegmentationWithLabelData(response, class_idx);
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

  $('#runNIM').prop('disabled', false);
  $('#imageURI').prop('readOnly', false);
  $('#loadImage').prop('disabled', false);
  $('#runNIM').prop('disabled', false);
  $('#runStatus').hide();
  document.getElementById('clickPrompts').selectize.enable();
}

async function fetchSeg() {
  const imageURI = $('#imageURI').val().toString();
  const nimsURI = $('#nimsURI').val().toString();
  const authHeader = $('#nimsAuthHeader').val().toString();
  const label = $('#clickPrompts').val().toString();

  console.log(cornerStoneImage);
  if (label) {
    autoRunLabels.set(label, saveAnnotations());
  }

  const class_idx = label && label !== '' ? parseInt(label) : 0;
  const classPrompts = [];
  const annotations =
    label && autoRunLabels.has(label) ? autoRunLabels.get(label) : null;
  const fg = label
    ? getClickPoints(cornerStoneImage?.ctVolume, annotations, 1)
    : [];
  const bg = label
    ? getClickPoints(cornerStoneImage?.ctVolume, annotations, 2)
    : [];
  const nimReqData = {
    image: imageURI,
    prompts: {},
  };

  const usingPointPrompts = Object.keys(fg).length > 0;
  if (!usingPointPrompts) {
    classPrompts.push(class_idx);
  }

  if (usingPointPrompts) {
    nimReqData.prompts['points'] = {};
    nimReqData.prompts['points'][class_idx] = fg;
    if (Object.keys(bg).length > 0) {
      nimReqData.prompts['points'][0] = bg;
    }
  } else {
    nimReqData.prompts['classes'] = classPrompts;
  }
  console.log('nimReqData', nimReqData, usingPointPrompts, class_idx);

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
