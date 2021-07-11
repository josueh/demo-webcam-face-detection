const PROBABILITY_PREDICTION_PASS = 0.99 // %
const VIDEO_WIDTH = 320
const VIDEO_HEIGHT = 240

window.addEventListener(`load`, async () => {
  const faceDetector = await createFaceDetector()
  faceDetector.on(`face`, faceDetected => {
    console.log(`face center axis x:`, faceDetected.face[0])
  })
  createWebcamVideo(`picture-frame`, videoFrame => {
    faceDetector.updateImage(videoFrame)
  })
})

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
