import * as BABYLON from 'babylonjs';


let engine, scene, camera, canvas, axesLinesViewer, light, selectedFaceMaterial, faceToExtrude, boxMaterial
let meshArr = [];
let meshHeight = 1, meshWidth = 1, meshDepth = 1;
let clickedOnce = false;
const boxName = "theBox";

function init() {
  canvas = document.getElementById("renderCanvas"); // Get the canvas element
  engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
  scene = new BABYLON.Scene(engine);

  //create camera
  camera = new BABYLON.ArcRotateCamera("Camera", Math.PI / 4, Math.PI / 4, 10, new BABYLON.Vector3(0, 0, 0), scene);
  camera.setPosition(new BABYLON.Vector3(10, 10, 10));
  camera.rotation = new BABYLON.Vector3(Math.PI / 4, -Math.PI / 4, 0);
  camera.attachControl(canvas, true);

  // camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, new BABYLON.Vector3(0, 0, 0));
  light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);

  //add axes lines to the scene
  axesLinesViewer = new BABYLON.AxesViewer(scene, 25, undefined, undefined, undefined, undefined, 0.1);

  //create and infinite plane to enable fetching points anywhere in the scene
  let planeWidth = canvas.width;
  let planeHeight = canvas.height;
  let invisibleXYPlane = BABYLON.MeshBuilder.CreatePlane("invisibleXYPlane", { width: planeWidth, height: planeHeight }, scene);
  invisibleXYPlane.position = new BABYLON.Vector3(0, 0, 0);
  invisibleXYPlane.visibility = 0;
  invisibleXYPlane.isPickable = true;

  let invisibleYZPlane = BABYLON.MeshBuilder.CreatePlane("invisibleXYPlane", { width: planeWidth, height: planeHeight }, scene);
  invisibleYZPlane.rotation.x = Math.PI / 2; // rotate the plane by 90 degrees around the X axis
  invisibleYZPlane.position.y = 0.5; // center the plane at y=0.5
  invisibleYZPlane.visibility = 0;
  invisibleYZPlane.isPickable = true;

  //create materials
  selectedFaceMaterial = new BABYLON.StandardMaterial("selectedFaceMaterial", scene);
  selectedFaceMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0.5); // blue
  selectedFaceMaterial.alpha = 0.4

  boxMaterial = new BABYLON.StandardMaterial('boxMaterial', scene);
  boxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0); //black
  boxMaterial.alpha = 1;


  window.addEventListener("click", onClick);
  window.addEventListener("onResize", onWindowResize)

  // if "r" is pressed on keyboard reset the box
  window.addEventListener("keydown", (event) => {
    if (event.key === "r") {
      reset()
    }
  });


  draw()
  runRenderLoop()
}

function draw() {

  //array of mesh objects that are present in the current scene
  //dispose all the objects
  meshArr.forEach(e => {
    e.dispose();
    e.dispose();
    scene?.removeMesh(e);
  });
  meshArr = [];

  //create a box with custom heigth, width and depth
  const box = BABYLON.MeshBuilder.CreateBox(boxName, { width: meshWidth, height: meshHeight, depth: meshDepth }, scene);
  box.material = boxMaterial

  // Set the position of the box so that one vertex is at the origin
  box.position = new BABYLON.Vector3(meshWidth / 2, meshHeight / 2, meshDepth / 2);

  meshArr.push(box)

  //add all elements back to scene
  meshArr.forEach(e => {
    scene?.addMesh(e);
  });
}

function onClick() {
  // Get the mouse position
  const pickResult = scene?.pick(scene.pointerX, scene.pointerY);

  //check if box is already clicked once and the face is selected
  if (!clickedOnce) {
    //check if user has clicked on the box only
    if (pickResult?.hit && pickResult.pickedMesh?.name === boxName) {
      faceToExtrude = pickResult.faceId;
      clickedOnce = true;

      // Highlight the selected face
      highlightFace(pickResult.pickedMesh, faceToExtrude);
      animate(pickResult.pickedMesh, faceToExtrude)


    }
  } else {

    //check if the pickresult was able to pick any of the meshes
    //this is required because if the pickresult did not pick any mesh then it wont be able to provide pickedPoint
    if (pickResult?.hit) {
      const box = meshArr.find((mesh) => mesh.name === boxName);
      let faceNormal = box.getFacetNormal(faceToExtrude);
      if (faceNormal._x != 0) {
        meshWidth = pickResult.pickedPoint._x
      } else if (faceNormal._y != 0) {
        meshHeight = pickResult.pickedPoint._y
      } else if (faceNormal._z != 0) {
        meshDepth = pickResult.pickedPoint._z
      }
      draw();
      clickedOnce = false;
    }
  }

}

//to highlight specific face of a mesh
function highlightFace(mesh, faceId) {
  const face = faceId / 2
  const facet = 2 * Math.floor(face);
  const clr = new BABYLON.Color3(0, 0, 1); // blue
  const indices = mesh.getIndices();
  const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const nbVertices = positions.length / 3;
  let colors = mesh.getVerticesData(BABYLON.VertexBuffer.ColorKind);
  if (!colors) {
    colors = new Array(4 * nbVertices);
    colors = colors.fill(1);
  }
  let vertex;
  for (let i = 0; i < 6; i++) {
    vertex = indices[3 * facet + i];
    colors[4 * vertex] = clr.r;
    colors[4 * vertex + 1] = clr.g;
    colors[4 * vertex + 2] = clr.b;
    colors[4 * vertex + 3] = 1;
  }

  mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
}

function animate(mesh, faceToExtrude) {
  var clonedMesh = mesh.clone("animationMesh")

  //add mesh to meshArr so that it can be cleaned up when draw() function is called
  meshArr.push(clonedMesh)

  //add cloned mesh for animation to scene
  scene.addMesh(clonedMesh);

  // initilize the box with current size of the box
  let tempMeshWidth = meshWidth, tempMeshHeight = meshHeight, tempMeshDepth = meshDepth;
  
  const faceNormal = mesh.getFacetNormal(faceToExtrude);

  // Animate the extrusion
  const animateExtrusion = () => {

    //getting latest mouse positon
    const pickResult = scene?.pick(scene.pointerX, scene.pointerY);

    //rather then creating new mesh objects we can scale one single object because the initial mesh = the box
    //check the direction of extrusions using using the normal vector of the selected face
    if (faceNormal._x != 0) {
      tempMeshWidth = pickResult.pickedPoint._x
      clonedMesh.scaling._x = tempMeshWidth
    } else if (faceNormal._y != 0) {
      tempMeshHeight = pickResult.pickedPoint._y
      clonedMesh.scaling._y = tempMeshHeight
    } else if (faceNormal._z != 0) {
      tempMeshDepth = pickResult.pickedPoint._z
      clonedMesh.scaling._z = tempMeshDepth
    }

    clonedMesh.position = new BABYLON.Vector3(tempMeshWidth / 2, tempMeshHeight / 2, tempMeshDepth / 2);
    clonedMesh.material = selectedFaceMaterial;

    //finish animatin on 2nd click
    if (clickedOnce) {
      requestAnimationFrame(animateExtrusion);
    }
  };
  animateExtrusion();
}

//reset box to its original position and size
function reset() {
  meshDepth = 1;
  meshHeight = 1;
  meshWidth = 1;

  draw()
}
function onWindowResize() {
  engine.resize();
}

//Call the initialize scene
init();

// Register a render loop to repeatedly render the scene
function runRenderLoop() {
  engine.runRenderLoop(function () {
    scene?.render();
  });
}
