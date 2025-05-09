import { useCallback, useEffect } from "react";
import { finalMatrix$, svgMatrix$, useGearProjectStore, viewBoxA$, viewBoxB$ } from "./store";
import { combineLatest } from "rxjs";
import { useSelector } from "@xstate/react";
import { useDrag } from "./hooks/useDrag";
import { vec2, mat3 } from "gl-matrix";
import { useEditorMachineSend } from "./store";
import { useMantineTheme } from "@mantine/core";
import { getScale } from "./core/coordinate";

export const ExportViewBoxController = ({ id }: { id?: string }) => {
  const theme = useMantineTheme();
  const editorMachineActor = useGearProjectStore((state) => state.editorMachineActor);
  const send = useEditorMachineSend();
  const state = useSelector(editorMachineActor, (state) => state);
  const isViewportSetting = state.matches("ViewportSetting");
  const pushUndo = useGearProjectStore((state) => state.pushUndo);
  const handleDragEnd = useCallback(() => {
    pushUndo("Export ViewBox Change");
  }, [pushUndo]);
  const { ref, deltaMatrix$ } = useDrag<SVGPathElement>({ onDragEnd: handleDragEnd, disabled: !isViewportSetting });
  
  useEffect(() => {
    const subscription = combineLatest([viewBoxA$, viewBoxB$]).subscribe(([a, b]) => {
      if (ref.current) {
        ref.current.setAttribute('d', `M ${a[0]} ${a[1]} L ${b[0]} ${a[1]} L ${b[0]} ${b[1]} L ${a[0]} ${b[1]} Z`);
      }
    });
    return () => subscription.unsubscribe();
  }, [ref]);

  useEffect(() => {
    if (!isViewportSetting) return;
    const subscription = deltaMatrix$.subscribe((deltaMatrix) => {
      const screenPositionA = vec2.create();
      vec2.transformMat3(screenPositionA, viewBoxA$.getValue(), finalMatrix$.getValue());
      vec2.transformMat3(screenPositionA, screenPositionA, deltaMatrix);
      vec2.transformMat3(viewBoxA$.getValue(), screenPositionA, mat3.invert(mat3.create(), finalMatrix$.getValue()));
      viewBoxA$.next(viewBoxA$.getValue());
      
      const screenPositionB = vec2.create();
      vec2.transformMat3(screenPositionB, viewBoxB$.getValue(), finalMatrix$.getValue());
      vec2.transformMat3(screenPositionB, screenPositionB, deltaMatrix);
      vec2.transformMat3(viewBoxB$.getValue(), screenPositionB, mat3.invert(mat3.create(), finalMatrix$.getValue()));
      viewBoxB$.next(viewBoxB$.getValue());
    });
    return () => subscription.unsubscribe();
  }, [deltaMatrix$, isViewportSetting]);

  useEffect(() => {
    const subscription = svgMatrix$.subscribe((matrix) => {
      const scale = getScale(matrix);
      if (!ref.current) return;
      const target = ref.current;
      target.setAttribute('stroke-width', `${1 / scale[0]}`);
      target.setAttribute('stroke-dasharray', isViewportSetting ? `${2 / scale[0]} ${2 / scale[0]}` : "none");
    });
    return () => subscription.unsubscribe();
  }, [ref, isViewportSetting]);

  return (
    <path
      id={id}
      style={{
        cursor: isViewportSetting ? "grab" : "default",
      }}
      onClick={() => {
        send({ type: 'unselectGear' });
      }}
      ref={ref}
      stroke={isViewportSetting ? "black" : theme.colors.gray[4]}
      fill={isViewportSetting ? "rgba(255, 255, 255, 0)" : "white"}
      filter="drop-shadow(0 0 10px rgba(0, 0, 0, 0.1))"
    />
  )
}
