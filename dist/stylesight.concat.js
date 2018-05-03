"use strict"

const degToRad = x => x * Math.PI / 180

const getVideoFeed = (video) => {
    return new Promise((resolve) => {
        let getVideoFeedAttempts = 0
        let errMessage = "There was an error accessing the camera."

        if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
            errMessage += " iOS might still have no support for camera API."
        }

        if (!location.protocol.startsWith("https")) {
            errMessage += " Please make sure you are using https."
        }

        try {
            if ("mozGetUserMedia" in navigator) {
                navigator.mozGetUserMedia(
                    {audio: false, video: {facingMode: "environment"}},
                    stream => {
                        video.srcObject = stream
                        resolve()
                    },
                    err => {
                        console.log(err)
                        alert(errMessage)
                    }
                )
            } else {
                const mediaDevicesSupport = navigator.mediaDevices && navigator.mediaDevices.getUserMedia

                if (mediaDevicesSupport) {
                    navigator.mediaDevices
                        .getUserMedia({audio: false, video: {facingMode: "environment"}})
                        .then(stream => {
                            video.srcObject = stream
                            resolve()
                        })
                        .catch(err => {
                            console.log(err)
                            getVideoFeedAttempts++

                            // Rarely, getting the camera fails. Re-attempting usually works, on refresh.
                            if (getVideoFeedAttempts<3) {
                                getVideoFeed()
                            } else {
                                alert(errMessage)
                            }
                        })
                } else {
                    const getUserMedia =
                        navigator.getUserMedia ||
                        navigator.webkitGetUserMedia ||
                        navigator.mozGetUserMedia ||
                        navigator.msGetUserMedia

                    if (getUserMedia) {
                        getUserMedia(
                            {audio: false, video: {facingMode: "environment"}},
                            stream => {
                                video.srcObject = stream
                                resolve()
                            },
                            err => {
                                console.log(err)
                                alert(errMessage)
                            }
                        )
                    } else {
                        alert("Camera not available")
                    }
                }
            }

        } catch (e) {
            alert(errMessage)
        }
    })
}

window.addEventListener("load", async () => {

    // Menu toggle
    const controlMenuToggle = document.querySelector(".toggle")
    controlMenuToggle.addEventListener("click", () => controls.classList.toggle("open"))

    let activeStyle = "none"
    const styles = [
        {
            id: "none",
            name: "None",
        },
        {
            id: "udnie",
            name: "Udnie",
        },
        {
            id: "rain_princess",
            name: "Rain princess",
        },
        {
            id: "scream",
            name: "Scream",
        },
        {
            id: "la_muse",
            name: "La muse",
        },
        {
            id: "wave",
            name: "Wave",
        },
        {
            id: "wreck",
            name: "Wreck",
        },
    ]

    Net.styles = styles
    Net.activeStyle = styles[0]

    styles.forEach(style => {

        let img
        const {id, name} = style
        const styleDiv = document.createElement("div")
        styleDiv.className = "style"

        const label = document.createElement("span")
        label.innerHTML = name

        const loadingContainer = document.createElement("div")
        loadingContainer.className = "loadingContainer"
        const spinner = document.createElement("div")
        spinner.className = "spinner"
        const loadingNote = document.createElement("span")
        loadingNote.className = "loadingNote"
        loadingNote.innerHTML = "Loading..."

        if (id == "none") {
            label.style.width = "150px"
        } else {
            img = document.createElement("img")
            img.onload = () => loadingContainer.style.width = img.width + 20 + "px"
            img.src = `./images/${id}.jpg`
            styleDiv.appendChild(img)

            loadingContainer.appendChild(spinner)
            styleDiv.appendChild(loadingContainer)
            styleDiv.appendChild(loadingNote)
        }

        styleDiv.appendChild(label)
        stylesContainer.appendChild(styleDiv)

        styleDiv.addEventListener("click", async () => {

            if (activeStyle == id) {
                return
            }

            activeStyle = id
            Net.activeStyle.hasTexture = false

            if (Net.activeStyle.styleBox) {
                Net.activeStyle.styleBox.visible = false
            }

            Net.activeStyle = style

            if (id=="none") {
                makeBoxObject()
            } else {
                makeBoxObject(100)

                if (!style.model) {
                    loadingNote.style.display = "block"
                    spinner.style.display = "block"
                    img.style.opacity = 0.5
                    const model = await Net.loadStyle(id, (done, total) => loadingNote.innerHTML = `Loading... ${done}/${total}`)

                    spinner.remove()
                    loadingNote.remove()
                    img.style.opacity = 1

                    // Wait a frame to allow UI to update
                    requestAnimationFrame(() => {
                        style.model = model
                    })

                }
            }

            console.log("activeStyle", activeStyle)
        })
    })


    // VR stuff
    // ========
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)
    renderer.domElement.style.backgroundColor = "black"

    let effect = new THREE.VREffect(renderer)
    effect.separation = 0
    effect.setSize(window.innerWidth, window.innerHeight)

    let vrDisplay

    if (navigator.getVRDisplays) {
        navigator.getVRDisplays().then(displays => displays.length && (vrDisplay = displays[0]))
    }

    // Button to enable VR mode
    enterVRButton.addEventListener("click", () => {
        const controls = document.getElementById("controls")

        if (enterVRButton.classList.contains("small")) {
            // Close VR
            effect = new THREE.VREffect(renderer)
            effect.separation = 0
            effect.setSize(window.innerWidth, window.innerHeight)

            enterVRButton.classList.remove("small")
            controls.classList.remove("hidden")
        } else {
            if (navigator.userAgent.includes("Mobile VR")) {
                vrDisplay.requestPresent([{ source: renderer.domElement }])
            } else {
                effect = new THREE.StereoEffect(renderer)
                effect.separation = 0
                effect.setSize(window.innerWidth, window.innerHeight)
            }

            // Shrink VR button and hide controls
            enterVRButton.classList.add("small")
            controls.classList.add("hidden")
        }
    })

    // Scenes and camera
    const fov = 70
    const scene = new THREE.Scene()
    // const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 1000)
    let camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 1000)
    scene.add(camera)

    // Box object
    let boxMaterial
    let texture
    let box

    let styleMaterial
    let styleTexture
    let styleBox

    const inferenceCanvas = document.createElement("canvas")
    let inferenceContext = inferenceCanvas.getContext("2d")

    window.video = document.createElement("video")
    video.autoplay = true
    video.width = window.innerWidth
    video.height = window.innerHeight
    await getVideoFeed(video)

    const makeBoxObject = async (height) => {
        window.video = document.createElement("video")
        video.autoplay = true
        video.width = window.innerWidth
        video.height = window.innerHeight

        inferenceCanvas.height = height
        inferenceCanvas.width = video.width / video.height * height

        inferenceContext = inferenceCanvas.getContext("2d")
        await getVideoFeed(video)

        const boxWidth = video.width
        const boxHeight = video.height

        const boxGeometry = new THREE.BoxGeometry(boxWidth, boxHeight, 1)
        texture = new THREE.Texture(video)
        texture.minFilter = THREE.NearestFilter

        boxMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texture: {
                    type: "t",
                    value: texture
                }
            },
            vertexShader: vertexShaderSource.text,
            fragmentShader: Net.getVideoShader()
        })

        box = new THREE.Mesh(boxGeometry, boxMaterial)
        scene.add(box)

        camera.position.z = 0.5 * boxWidth * Math.atan(degToRad(90 - fov / 2)) + 100
    }

    // Render loop
    window.inferring = true
    const multScalar = tf.scalar(255)

    const render = async () => {

        if (video.currentTime) {
            texture.needsUpdate = true

            if (styleTexture) {
                styleTexture.needsUpdate = true
            }
        }

        if (!inferring && Net.activeStyle != "none") {
            if (Net.activeStyle != "none" && Net.activeStyle.hasOwnProperty("model")) {
                console.log("inferring")
                inferring = true
                inferenceContext.drawImage(video, 0, 0, inferenceCanvas.width, inferenceCanvas.height)

                const result = tf.tidy(() => {
                    const preprocessed = tf.fromPixels(inferenceCanvas)
                    const inferenceResult = Net.predict(preprocessed)
                    preprocessed.dispose()
                    return inferenceResult
                })

                result.mul(multScalar)

                const total = result.shape[0] * result.shape[1]
                const data = await result.data()
                const rgbaData = new Uint8Array(total * 4)

                for (let i=0; i<total; i++) {
                    rgbaData[i*4 + 0] = data[i*3 + 0]
                    rgbaData[i*4 + 1] = data[i*3 + 1]
                    rgbaData[i*4 + 2] = data[i*3 + 2]
                    rgbaData[i*4 + 3] = 255
                }

                // Create the style box if needed
                if (!Net.activeStyle.hasOwnProperty("hasTexture") || !Net.activeStyle.hasTexture) {
                    const styleGeometry = new THREE.BoxGeometry(video.width, video.height, 1)
                    styleTexture = new THREE.DataTexture(rgbaData, result.shape[1], result.shape[0], THREE.RGBAFormat, THREE.UnsignedByteType)
                    styleTexture.flipY = true

                    styleTexture.minFilter = THREE.NearestFilter
                    styleMaterial = new THREE.ShaderMaterial({
                        transparent: true,
                        uniforms: {
                            texture: {
                                type: "t",
                                value: styleTexture
                            },
                            width: {
                                type: "f",
                                value: video.width
                            },
                            height: {
                                type: "f",
                                value: video.height
                            },
                            radius: {
                                type: "f",
                                value: 0.4
                            },
                            intensity: {
                                type: "f",
                                value: 1.0
                            }
                        },
                        vertexShader: vertexShaderSource.text,
                        fragmentShader: Net.compileShader()
                    })


                    styleBox = new THREE.Mesh(styleGeometry, styleMaterial)
                    window.styleBox = styleBox
                    window.styleTexture = styleTexture

                    Net.activeStyle.hasTexture = true
                    Net.activeStyle.styleBox = styleBox

                    scene.add(styleBox)
                } else {
                    styleTexture.image.data = rgbaData
                }


                styleTexture.needsUpdate = true
                result.dispose()

                await tf.nextFrame()
                setTimeout(() => inferring = false, 10)
            }
        }

        if (Net.activeStyle == "none" && styleBox) {
            styleBox.visible = false
        }

        effect.render(scene, camera)
        requestAnimationFrame(render)
    }

    makeBoxObject()
    render()

    window.video.onloadedmetadata = () => inferring = false

    // Request fullscreen when tapped
    if (!window.location.href.includes("localhost")) {
        renderer.domElement.addEventListener("click", () => {
            document.fullscreenEnabled && renderer.domElement.requestFullScreen() ||
            document.webkitFullscreenEnabled && renderer.domElement.webkitRequestFullScreen() ||
            document.mozFullScreenEnabled && renderer.domElement.mozRequestFullScreen() ||
            document.msFullScreenEnabled && renderer.domElement.msRequestFullScreen()
        })
    }

    // Resizing
    window.addEventListener("resize", () => {
        effect.setSize(window.innerWidth, window.innerHeight)
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        scene.remove(box)
        video.pause()
        makeBoxObject()
    })

    // UI
    const updateRadius = () => {
        styleMaterial && (styleMaterial.uniforms.radius.value = parseFloat(radiusSlider.value))
        console.log("set radius to", parseFloat(radiusSlider.value))
    }


    radiusSlider.addEventListener("change", updateRadius)
    radiusSlider.addEventListener("mousemove", updateRadius)

})

"use strict"

const ckptsDir = document.URL.substr(0,document.URL.lastIndexOf("/")) + "/ckpts/"

class Net {

    static loadStyle (id, callback) {

        let checkpointManifest
        let vs = {}

        const getVariable = name => {
            return new Promise(resolve => {
                fetch(ckptsDir + id + "/" + name).then(r => r.arrayBuffer()).then(values => {
                    values = new Float32Array(values)
                    resolve(tf.Tensor.make(checkpointManifest[name].shape, {values}))
                })
            })
        }

        return new Promise(resolve => {
            fetch(ckptsDir+id+"/manifest.json").then(r => r.json()).then(manifest => {
                checkpointManifest = manifest

                const variableNames = Object.keys(checkpointManifest)

                const variablePromises = variableNames.map(getVariable)

                if (callback) {
                    let donePromises = 0
                    variablePromises.forEach(p => p.then(() => callback(++donePromises, variablePromises.length)))
                }

                Promise.all(variablePromises).then(variables => {
                    variables.forEach((val, vi) => {
                        vs[variableNames[vi]] = val
                    })
                    resolve(vs)
                })
            })
        })
    }

    static predict (preprocessedInput) {
        preprocessedInput.dtype = "float32"
        const conv1 = this.convLayer(preprocessedInput, 1, true, 0)
        const conv2 = this.convLayer(conv1, 2, true, 3)
        const conv3 = this.convLayer(conv2, 2, true, 6)
        const resid1 = this.residualBlock(conv3, 9)
        const resid2 = this.residualBlock(resid1, 15)
        const resid3 = this.residualBlock(resid2, 21)
        const resid4 = this.residualBlock(resid3, 27)
        const resid5 = this.residualBlock(resid4, 33)
        const convT1 = this.convTransposeLayer(resid5, 64, 2, 39)
        const convT2 = this.convTransposeLayer(convT1, 32, 2, 42)
        const convT3 = this.convLayer(convT2, 1, false, 45)
        const outTanh = tf.tanh(convT3)
        const scaled = tf.mul(tf.scalar(150), outTanh)
        const shifted = tf.add(tf.scalar(255/2), scaled)
        const clamped = tf.clipByValue(shifted, 0, 255)
        return clamped
        const normalized = tf.div(clamped, tf.scalar(255))
        return normalized
    }

    static convLayer (input, strides, relu, varId)  {
        const y = tf.conv2d(input, this.activeStyle.model[this.varName(varId)], 1, strides)
        const y2 = this.instanceNorm(y, varId + 1)

        if (relu) {
            return tf.relu(y2)
        }

        return y2
    }

    static convTransposeLayer (input, numFilters, strides, varId) {
        const [height, width, ] = input.shape
        const newRows = height * strides
        const newCols = width * strides
        const newShape = [newRows, newCols, numFilters]

        const y = tf.conv2dTranspose(input, this.activeStyle.model[this.varName(varId)], newShape, strides, "same")
        const y2 = this.instanceNorm(y, varId + 1)
        const y3 = tf.relu(y2)

        return y3
    }

    static residualBlock (input, varId) {
        const conv1 = this.convLayer(input, 1, true, varId)
        const conv2 = this.convLayer(conv1, 1, false, varId + 3)
        return tf.addStrict(conv2, input)
    }

    static instanceNorm (input, varId)  {
        const [height, width, inDepth] = input.shape
        const moments = tf.moments(input, [0, 1])
        const mu = moments.mean
        const sigmaSq = moments.variance
        const shift = this.activeStyle.model[this.varName(varId)]
        const scale = this.activeStyle.model[this.varName(varId + 1)]
        const epsilon = 1e-3
        const normalized = tf.div(tf.sub(input, mu),
        tf.sqrt(tf.add(sigmaSq, tf.scalar(epsilon))))
        const shifted = tf.add(tf.mul(scale, normalized), shift)
        return shifted.as3D(height, width, inDepth)
    }

    static varName (varId) {
        if (varId === 0) {
            return "Variable"
        } else {
            return "Variable_" + varId.toString()
        }
    }

    static getVideoShader () {
        return `
            uniform sampler2D texture;
            varying vec2 vUv;

            void main() {
                gl_FragColor = texture2D(texture, vUv);
            }
        `
    }

    static compileShader () {
        return `
            uniform sampler2D texture;
            uniform float width;
            uniform float height;
            uniform float radius;
            uniform float intensity;
            uniform vec2 resolution;
            varying vec2 vUv;

            float rand(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }

            void main() {

                float w = 1.0 / width;
                float h = 1.0 / height;

                vec4 pixel = texture2D(texture, vUv);

                if (sqrt( (0.5 - vUv[0])*(0.5 - vUv[0]) + (0.5 - vUv[1])*(0.5 - vUv[1]) ) < radius) {

                    gl_FragColor = pixel;

                    // gl_FragColor = newColour*(1.0-intensity) + pixel*intensity;

                } else {
                    gl_FragColor.a = 0.0;
                }
            }
        `
    }
}
//# sourceMappingURL=stylesight.concat.js.map