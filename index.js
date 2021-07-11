window.addEventListener(`load`, async () => {
  createWebcamVideo(`camera-video`)
})

function createWebcamVideo(domContainerId) {
  const video = document.getElementById(domContainerId)
  withCameraStream(stream => {
    video.srcObject = stream
    video.play()
  })
}

function withCameraStream(fnStreamHandler) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(fnStreamHandler)
      .catch(() => alert(`Sorry... we need a camera to continue.`))
  }
}
