#!/usr/bin/env node
/**
 * Reduce el follaje de un modelo (árboles, arbustos): por material, une los
 * vértices que comparten posición (las costuras de UV/color trababan al
 * simplificador) y simplifica permitiendo borrar hojas sueltas (Prune).
 * No sirve para objetos sólidos: corre la textura (para esos, la
 * simplificación común de fetch-street-assets.mjs).
 *
 * Usa @gltf-transform/{core,extensions,functions}, draco3dgltf y meshoptimizer
 * (los del CLI de gltf-transform; no son dependencias del proyecto):
 *   node scripts/camofduty/reduce-foliage.mjs entrada.glb salida.glb branches=0.12 leaves=0.55 trunk=0.4
 *   npx -y @gltf-transform/cli@4.1.1 meshopt salida.glb public/camofduty/street/models/tree-jacaranda.glb
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { compactPrimitive } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
MeshoptSimplifier.useExperimentalFeatures = true;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule(), "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const [input, output, ...rules] = process.argv.slice(2);
const ratios = Object.fromEntries(rules.map((r) => r.split("=")).map(([k, v]) => [k, Number(v)]));
const doc = await io.read(input);
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const mat = prim.getMaterial()?.getName() ?? "";
    const key = Object.keys(ratios).find((k) => mat.includes(k));
    if (!key) continue;
    const pos = prim.getAttribute("POSITION");
    const n = pos.getCount();
    const positions = new Float32Array(n * 3);
    const el = [];
    for (let i = 0; i < n; i++) {
      pos.getElement(i, el);
      positions.set(el, i * 3);
    }
    const idxAcc = prim.getIndices();
    const indices = new Uint32Array(idxAcc.getArray());
    const target = Math.max(3, Math.floor((indices.length * ratios[key]) / 3) * 3);
    // Une los vértices que comparten posición (costuras de UV/color) para que no traben.
    const first = new Map();
    const weld = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(positions[i * 3] * 1e4)},${Math.round(positions[i * 3 + 1] * 1e4)},${Math.round(positions[i * 3 + 2] * 1e4)}`;
      if (!first.has(k)) first.set(k, i);
      weld[i] = first.get(k);
    }
    const welded = indices.map((i) => weld[i]);
    const [out] = MeshoptSimplifier.simplify(welded, positions, 3, target, 0.08, ["Prune"]);
    idxAcc.setArray(n > 65535 ? new Uint32Array(out) : new Uint16Array(out));
    compactPrimitive(prim);
    console.log(`${mat}: ${indices.length / 3} → ${out.length / 3} triángulos`);
  }
}
await io.write(output, doc);
