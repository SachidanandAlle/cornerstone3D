import { ProbeTool } from '@cornerstonejs/tools';
import {
  Annotation,
  EventTypes,
  PublicToolProps,
  ToolProps,
} from '@cornerstonejs/tools/src/types';
import { StyleSpecifier } from '@cornerstonejs/tools/src/types/AnnotationStyle';
import { ProbeAnnotation } from '@cornerstonejs/tools/src/types/ToolSpecificAnnotationTypes';

export default class MyProbeTool extends ProbeTool {
  constructor(
    toolProps: PublicToolProps = {},
    defaultToolProps: ToolProps = {
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {
        shadow: true,
        preventHandleOutsideImage: false,
        getTextLines: noneGetTextLines,
        customColor: 'rgb(0,255,0)',
      },
    }
  ) {
    super(toolProps, defaultToolProps);
  }

  protected addNewAnnotation(
    evt: EventTypes.InteractionEventType
  ): ProbeAnnotation {
    const annotation = super.addNewAnnotation(evt);
    annotation.data.mouseButton = evt.detail.mouseButton;
    return annotation;
  }

  protected getAnnotationStyle(context: {
    annotation: Annotation;
    styleSpecifier: StyleSpecifier;
  }) {
    const s = super.getAnnotationStyle(context);
    s.color =
      context.annotation?.data?.mouseButton === 2
        ? 'rgb(255,0,0)'
        : 'rgb(0,255,0)';
    return s;
  }
}

function noneGetTextLines(): string[] {
  return [];
}
