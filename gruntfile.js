module.exports = grunt => {
    grunt.initConfig({
        concat: {
            options: {
                sourceMap: true
            },
            "js": {
                src: ["dev/stylesight.js", "dev/net.js"],
                dest: "dist/stylesight.concat.js"
            },
            "deps": {
                src: ["lib/StereoEffect.js", "lib/VREffect.js"],
                dest: "dist/dependencies.concat.js"
            }
        },

        uglify: {
            my_target: {
                options: {
                    sourceMap: true,
                    mangle: false,
                },
                files: {
                    "dist/stylesight.min.js" : ["dist/stylesight.concat.js"],
                    "dist/dependencies.min.js" : ["lib/three.min.js", "dist/dependencies.concat.js"]
                }
            }
        },

        watch: {
            dev: {
                files: ["dev/*.js"],
                tasks: ["concat:js", "uglify"]
            },
            deps: {
                files: ["lib/*.js"],
                tasks: ["concat:deps", "uglify"]
            }
        }
    })

    grunt.loadNpmTasks("grunt-contrib-watch")
    grunt.loadNpmTasks('grunt-contrib-concat')
    grunt.loadNpmTasks('grunt-contrib-uglify-es')

    grunt.registerTask("default", ["watch"])
}