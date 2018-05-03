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