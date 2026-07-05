"use client";

import PhotographicBlockRoot from "./PhotographicBlockRoot";
import PhotographicHdriEnvironment from "./PhotographicHdriEnvironment";
import PhotographicMovingVehicle from "./PhotographicMovingVehicle";
import PhotographicMovingPedestrians from "./PhotographicMovingPedestrians";
import PhotographicStaticPedestrians from "./PhotographicStaticPedestrians";
import LightCalibrationProps from "./LightCalibrationProps";
import SunController from "../SunController";

/**
 * Contenido de Ciudad Fotográfica — sin cielo procedural ni Environment preset.
 * Iluminación: HDRI (IBL) + sol direccional. Sin ambientLight de relleno.
 */
export default function PhotographicCityContent() {
  return (
    <>
      <PhotographicHdriEnvironment />
      <SunController />
      <PhotographicBlockRoot />
      <PhotographicMovingVehicle />
      <PhotographicMovingPedestrians />
      <PhotographicStaticPedestrians />
      <LightCalibrationProps />
    </>
  );
}
