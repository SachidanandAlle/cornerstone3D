import { getEnabledElement } from '@cornerstonejs/core';
import type { Types } from '@cornerstonejs/core';

import { BaseTool } from '../base';
import {
  PublicToolProps,
  ToolProps,
  EventTypes,
  ToolGroupSpecificRepresentation,
} from '../../types';
import { triggerSegmentationModified } from '../../stateManagement/segmentation/triggerSegmentationEvents';
import triggerAnnotationRenderForViewportIds from '../../utilities/triggerAnnotationRenderForViewportIds';
import { getActiveSegmentationRepresentation } from '../../stateManagement/segmentation/activeSegmentation';
import RepresentationTypes from '../../enums/SegmentationRepresentations';
import { setActiveSegmentIndex } from '../../stateManagement/segmentation/segmentIndex';
import { getSegmentAtWorldPoint } from '../../utilities/segmentation';
import { state } from '../../store';

/**
 * Represents a tool used for segment selection. It is used to select a segment
 * by hovering over it.
 *
 */
class SegmentSelectTool extends BaseTool {
  static toolName;
  private hoverTimer: ReturnType<typeof setTimeout> | null;

  constructor(
    toolProps: PublicToolProps = {},
    defaultToolProps: ToolProps = {
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {
        hoverTimeout: 750,
      },
    }
  ) {
    super(toolProps, defaultToolProps);
    this.hoverTimer = null;
  }

  mouseMoveCallback = (evt: EventTypes.InteractionEventType): boolean => {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
    }

    this.hoverTimer = setTimeout(() => {
      this._setActiveSegment(evt);
      this.hoverTimer = null;
    }, this.configuration.hoverTimeout);

    return true;
  };

  onSetToolEnabled = (): void => {
    this.onSetToolActive();
  };

  onSetToolActive = (): void => {
    this.hoverTimer = null;
  };

  onSetToolDisabled = (): void => {
    this.hoverTimer = null;
  };

  _setActiveSegment(evt = {} as EventTypes.InteractionEventType): void {
    if (state.isInteractingWithTool) {
      return;
    }

    const { element, currentPoints } = evt.detail;

    const worldPoint = currentPoints.world;

    const enabledElement = getEnabledElement(element);

    if (!enabledElement) {
      return;
    }

    const { viewport } = enabledElement;

    const activeSegmentationReps = getActiveSegmentationRepresentation(
      this.toolGroupId
    );

    if (!activeSegmentationReps) {
      return;
    }

    if (
      [RepresentationTypes.Labelmap, RepresentationTypes.Contour].includes(
        activeSegmentationReps.type
      )
    ) {
      this._setActiveSegmentForType(
        activeSegmentationReps,
        worldPoint,
        viewport
      );
    } else {
      console.warn(
        'SegmentSelectTool does not support the current segmentation type.'
      );
    }
  }

  _setActiveSegmentForType(
    activeSegmentationReps: ToolGroupSpecificRepresentation,
    worldPoint: Types.Point3,
    viewport: Types.IStackViewport | Types.IVolumeViewport
  ): void {
    const imageDataInfo = viewport.getImageData();

    if (!imageDataInfo) {
      return;
    }

    const { segmentationId, segmentationRepresentationUID } =
      activeSegmentationReps;

    const hoveredSegmentIndex = getSegmentAtWorldPoint(
      viewport,
      worldPoint,
      segmentationRepresentationUID
    );

    // No need to select background
    if (!hoveredSegmentIndex || hoveredSegmentIndex === 0) {
      return;
    }

    setActiveSegmentIndex(segmentationId, hoveredSegmentIndex);

    const renderingEngine = viewport.getRenderingEngine();
    const viewportIds = renderingEngine.getViewports().map((v) => v.id);

    // update states
    triggerSegmentationModified(segmentationId);
    triggerAnnotationRenderForViewportIds(renderingEngine, viewportIds);
  }
}

SegmentSelectTool.toolName = 'SegmentSelectTool';
export default SegmentSelectTool;
