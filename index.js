const PROBABILITY_PREDICTION_PASS = 0.99 // %
const VIDEO_WIDTH = 320
const VIDEO_HEIGHT = 240

window.addEventListener(`load`, async () => {
  const facePicture = createFacePictureControl(`picture-frame`)
  const faceDetector = await createFaceDetector()
  faceDetector.on(`face`, face => {
    facePicture.sync(face)
  })
  createWebcamVideo(`picture-frame`, videoFrame => {
    faceDetector.updateImage(videoFrame)
  })
})

function createFacePictureControl(domContainerId) {
  const domElement = document.getElementById(domContainerId)
  const position = {
    x: 0,
    y: 0,
  }
  function updateDOMStyle() {
    domElement.style.left = parseInt(position.x) + `px`
    domElement.style.top  = parseInt(position.y) + `px`
  }
  function applyBoundingBox() {
    const { x, y } = position
    const maxX = window.innerWidth
    const maxY = window.innerHeight
    if (x < -VIDEO_WIDTH)  position.x = -VIDEO_WIDTH
    if (y < -VIDEO_HEIGHT) position.y = -VIDEO_HEIGHT
    if (x > maxX) position.x = maxX
    if (y > maxY) position.y = maxY
  }
  function easingMove(axis, newValue) {
    const strengh = 30
    const oldValue = position[axis]
    position[axis] += (newValue - oldValue) / strengh
  }
  function updatePositionX(face) {
    const domain = 40
    const move = face.face[0] - face.eyes[0] // usually range [-domain .. +domain]
    const signal = move < 0 ? -1 : +1
    const alpha = (Math.min(domain, Math.abs(move)) / domain) * signal // [-1 .. +1]
    const newX = window.innerWidth * ((alpha + 1) / 2)
    easingMove(`x`, newX - (VIDEO_WIDTH / 2))
  }
  function updatePositionY(face) {
    const domain = 30
    const move = face.eyes[1] - face.ears[1] // usually range [0 .. +domain]
    const alpha = Math.min(domain, Math.abs(move)) / domain // [0 .. +1]
    const newY = window.innerHeight * (1 - alpha)
    easingMove(`y`, newY - (VIDEO_HEIGHT / 4))
  }
  return {
    sync: faceDetected => {
      updatePositionX(faceDetected)
      updatePositionY(faceDetected)
      applyBoundingBox()
      updateDOMStyle()
    }
  }
}

function createWebcamVideo(domContainerId, frameCallback) {
  const container = document.getElementById(domContainerId)
  const video = container.querySelector(`video`)
  const canvas = container.querySelector(`canvas`)
  const context = canvas.getContext(`2d`)
  withCameraStream(stream => {
    video.srcObject = stream
    video.addEventListener(`loadeddata`, renderAnimationFrame)
    video.play()
  })
  function renderAnimationFrame() {
    requestAnimationFrame(renderAnimationFrame)
    context.drawImage(video, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT)
    frameCallback(video)
  }
}

function withCameraStream(fnStreamHandler) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(fnStreamHandler)
      .catch(() => alert(`Sorry... we need a camera to continue.`))
  }
}

/*
 * blazeface model ~ `prediction` is an object describing each detected face
 * {
 *   topLeft: [232.28, 145.26],
 *   bottomRight: [449.75, 308.36],
 *   probability: [0.998],
 *   landmarks: [
 *     [295.13, 177.64], // right eye
 *     [382.32, 175.56], // left eye
 *     [341.18, 205.03], // nose
 *     [345.12, 250.61], // mouth
 *     [252.76, 211.37], // right ear
 *     [431.20, 204.93]  // left ear
 *   ]
 * }
 * output model ~ some facial features by distance measure (midpoints)
 * {
 *   face: [340.52, 226.68], // center face
 *   eyes: [302.14, 176.32], // center eyes
 *   ears: [342.56, 207.89], // center ears
 * }
 */
function simplifyFaceModel(faceModel) {
  const { topLeft, bottomRight, landmarks } = faceModel
  const axisIndexes = [0, 1]
  return {
    face: axisIndexes.map(axis => (topLeft[axis] + bottomRight[axis]) * 0.5),
    eyes: axisIndexes.map(axis => (landmarks[1][axis] + landmarks[0][axis]) * 0.5),
    ears: axisIndexes.map(axis => (landmarks[5][axis] + landmarks[4][axis]) * 0.5),
  }
}

async function createFaceDetector() {
  const model = await blazeface.load()
  let onFaceDetected = () => {}
  return {
    on: (topic, fn) => {
      if (topic === `face`) {
        onFaceDetected = fn
      }
    },
    updateImage: async video => {
      const predictions = await model.estimateFaces(video)
      const firstFace = predictions[0]
      if (firstFace && firstFace.probability[0] > PROBABILITY_PREDICTION_PASS) {
        const face = simplifyFaceModel(firstFace)
        onFaceDetected(face)
      }
    }
  }
}
