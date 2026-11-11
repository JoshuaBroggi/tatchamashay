// Minimal USDA writer for three.js scene graphs.
//
// three's own USDZExporter flattens the hierarchy into world-space meshes named
// `Object_<id>`, which loses the hinged chest lid and the named parts the app
// tints. This writer keeps every Group as an Xform with its local transform and
// uses each object's `.name` as the prim name. Materials are plain
// UsdPreviewSurface descriptions keyed by name (see `mesh.userData.mat`).

import * as THREE from 'three';

const num = (x) => {
  const v = Math.abs(x) < 1e-7 ? 0 : +x.toFixed(5);
  return Object.is(v, -0) ? '0' : String(v);
};
const vec = (a) => `(${a.map(num).join(', ')})`;

function primName(raw, used) {
  let n = (raw || 'Part').replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(n)) n = '_' + n;
  let out = n, i = 2;
  while (used.has(out)) out = `${n}_${i++}`;
  used.add(out);
  return out;
}

function matrix(obj) {
  obj.updateMatrix();
  const e = obj.matrix.elements; // column-major = USD row-vector rows
  const rows = [0, 4, 8, 12].map((o) => vec([e[o], e[o + 1], e[o + 2], e[o + 3]]));
  return `( ${rows.join(', ')} )`;
}

function meshBody(geo, pad) {
  const g = geo.index ? geo : geo.clone().setIndex([...Array(geo.attributes.position.count).keys()]);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const idx = g.index.array;
  const pts = [], nrm = [], st = [];
  for (let i = 0; i < pos.count; i++) {
    pts.push(vec([pos.getX(i), pos.getY(i), pos.getZ(i)]));
    if (nor) nrm.push(vec([nor.getX(i), nor.getY(i), nor.getZ(i)]));
    if (uv) st.push(vec([uv.getX(i), uv.getY(i)]));
  }
  g.computeBoundingBox();
  const b = g.boundingBox;
  const lines = [
    `int[] faceVertexCounts = [${new Array(idx.length / 3).fill(3).join(', ')}]`,
    `int[] faceVertexIndices = [${Array.from(idx).join(', ')}]`,
    `point3f[] points = [${pts.join(', ')}]`,
    `float3[] extent = [${vec(b.min.toArray())}, ${vec(b.max.toArray())}]`,
  ];
  if (nor) lines.push(`normal3f[] normals = [${nrm.join(', ')}] (\n${pad}    interpolation = "vertex"\n${pad})`);
  if (uv) lines.push(`texCoord2f[] primvars:st = [${st.join(', ')}] (\n${pad}    interpolation = "vertex"\n${pad})`);
  lines.push('uniform token subdivisionScheme = "none"');
  return lines.map((l) => pad + l).join('\n');
}

function writeNode(obj, path, used, pad, out, root) {
  const name = primName(obj.name, used);
  const p = `${path}/${name}`;
  const inner = pad + '    ';
  if (obj.isMesh) {
    const mat = obj.userData.mat;
    if (!root.materials[mat]) throw new Error(`${p}: unknown material "${mat}"`);
    root.usedMaterials.add(mat);
    out.push(`${pad}def Mesh "${name}" (\n${pad}    prepend apiSchemas = ["MaterialBindingAPI"]\n${pad})\n${pad}{`);
    out.push(`${inner}matrix4d xformOp:transform = ${matrix(obj)}`);
    out.push(`${inner}uniform token[] xformOpOrder = ["xformOp:transform"]`);
    out.push(`${inner}rel material:binding = <${root.matPath}/${mat}>`);
    out.push(meshBody(obj.geometry, inner));
    if (obj.children.length) throw new Error(`${p}: meshes cannot have children, wrap them in a Group`);
    out.push(`${pad}}`);
    root.meshNames.push({ name, mat });
    return;
  }
  out.push(`${pad}def Xform "${name}"\n${pad}{`);
  out.push(`${inner}matrix4d xformOp:transform = ${matrix(obj)}`);
  out.push(`${inner}uniform token[] xformOpOrder = ["xformOp:transform"]`);
  const kids = new Set();
  for (const c of obj.children) writeNode(c, p, kids, inner, out, root);
  out.push(`${pad}}`);
}

function writeMaterial(name, m, base, pad) {
  const sp = `${base}/${name}`;
  const i1 = pad + '    ', i2 = i1 + '    ';
  const o = [`${pad}def Material "${name}"`, `${pad}{`,
    `${i1}token outputs:surface.connect = <${sp}/Surface.outputs:surface>`];
  const tex = [];
  const surf = [`${i1}def Shader "Surface"`, `${i1}{`, `${i2}uniform token info:id = "UsdPreviewSurface"`];
  if (m.map) {
    surf.push(`${i2}color3f inputs:diffuseColor.connect = <${sp}/DiffuseTexture.outputs:rgb>`);
    tex.push(
      `${i1}def Shader "UVReader"`, `${i1}{`,
      `${i2}uniform token info:id = "UsdPrimvarReader_float2"`,
      `${i2}string inputs:varname = "st"`,
      `${i2}float2 outputs:result`, `${i1}}`,
      `${i1}def Shader "DiffuseTexture"`, `${i1}{`,
      `${i2}uniform token info:id = "UsdUVTexture"`,
      `${i2}asset inputs:file = @${m.map}@`,
      `${i2}float2 inputs:st.connect = <${sp}/UVReader.outputs:result>`,
      `${i2}token inputs:sourceColorSpace = "sRGB"`,
      `${i2}token inputs:wrapS = "repeat"`, `${i2}token inputs:wrapT = "repeat"`,
      `${i2}float3 outputs:rgb`, `${i1}}`);
  } else {
    surf.push(`${i2}color3f inputs:diffuseColor = ${vec(srgbToLinear(m.color ?? '#cccccc'))}`);
  }
  surf.push(`${i2}float inputs:roughness = ${num(m.roughness ?? 0.6)}`);
  surf.push(`${i2}float inputs:metallic = ${num(m.metallic ?? 0)}`);
  if (m.emissive) surf.push(`${i2}color3f inputs:emissiveColor = ${vec(srgbToLinear(m.emissive).map((c) => c * (m.emissiveIntensity ?? 1)))}`);
  if (m.opacity !== undefined) surf.push(`${i2}float inputs:opacity = ${num(m.opacity)}`);
  if (m.clearcoat) surf.push(`${i2}float inputs:clearcoat = ${num(m.clearcoat)}`, `${i2}float inputs:clearcoatRoughness = 0.05`);
  surf.push(`${i2}token outputs:surface`, `${i1}}`);
  o.push(...surf, ...tex, `${pad}}`);
  return o.join('\n');
}

export function srgbToLinear(hex) {
  const c = new THREE.Color(hex); // three converts sRGB hex to linear working space
  return [c.r, c.g, c.b];
}

// Serialize `root` (a THREE.Group) and its materials into a USDA layer.
export function toUSDA(root, materials) {
  const rootName = primName(root.name, new Set());
  const state = { materials, usedMaterials: new Set(), matPath: `/${rootName}/Materials`, meshNames: [] };
  const body = [];
  const kids = new Set(['Materials']);
  for (const c of root.children) writeNode(c, `/${rootName}`, kids, '    ', body, state);
  const mats = [...state.usedMaterials].map((n) => writeMaterial(n, materials[n], state.matPath, '        '));
  const text = `#usda 1.0
(
    defaultPrim = "${rootName}"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "${rootName}" (
    kind = "component"
)
{
    matrix4d xformOp:transform = ${matrix(root)}
    uniform token[] xformOpOrder = ["xformOp:transform"]

    def Scope "Materials"
    {
${mats.join('\n')}
    }

${body.join('\n')}
}
`;
  return { text, meshNames: state.meshNames, textures: [...state.usedMaterials].map((n) => materials[n].map).filter(Boolean) };
}
