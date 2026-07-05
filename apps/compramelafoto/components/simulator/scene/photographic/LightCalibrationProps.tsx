"use client";

/**
 * Props mínimos para calibrar luz HDRI + ACES + exposición.
 * NO es contenido de escena final — solo esferas/cubo de referencia.
 * El suelo real es el glTF `street-asphalt.glb`.
 */
export default function LightCalibrationProps() {
  return (
    <group
      name="cod-light-calibration-props"
      position={[5.5, 0, 2]}
      userData={{ codLightCalibration: true }}
    >
      {/* Esfera metálica — reflejos del HDRI */}
      <mesh position={[-0.6, 0.32, 0.4]} castShadow receiveShadow>
        <sphereGeometry args={[0.32, 48, 48]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={1}
          roughness={0.12}
          name="cal-metal-sphere"
        />
      </mesh>

      {/* Esfera plástica / rough */}
      <mesh position={[0.3, 0.28, 0.6]} castShadow receiveShadow>
        <sphereGeometry args={[0.28, 48, 48]} />
        <meshStandardMaterial
          color="#e6e6e6"
          metalness={0}
          roughness={0.42}
          name="cal-plastic-sphere"
        />
      </mesh>

      {/* Cubo mate */}
      <mesh position={[1.2, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial
          color="#b8b8b8"
          metalness={0}
          roughness={0.96}
          name="cal-matte-cube"
        />
      </mesh>
    </group>
  );
}
