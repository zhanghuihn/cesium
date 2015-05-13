/*global define*/
define([
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/PixelFormat',
        '../Renderer/PixelDatatype',
        '../Shaders/PostProcessFilters/PassThrough'
    ], function(
        defined,
        defineProperties,
        destroyObject,
        PixelFormat,
        PixelDatatype,
        PassThrough) {
    "use strict";
    /*global WebGLRenderingContext*/

    /**
     * @private
     */
    var PickDepth = function(context) {
        this.framebuffer = undefined;

        this._depthTexture = undefined;
        this._textureToCopy = undefined;
        this._copyDepthCommand = undefined;
    };

    function destroyTextures(pickDepth) {
        pickDepth._depthTexture = pickDepth._depthTexture && !pickDepth._depthTexture.isDestroyed() && pickDepth._depthTexture.destroy();
    }

    function destroyFramebuffers(pickDepth) {
        pickDepth.framebuffer = pickDepth.framebuffer && !pickDepth.framebuffer.isDestroyed() && pickDepth.framebuffer.destroy();
    }

    function createTextures(pickDepth, context, width, height) {
        pickDepth._depthTexture = context.createTexture2D({
            width : width,
            height : height,
            pixelFormat : PixelFormat.RGBA,
            pixelDatatype : PixelDatatype.UNSIGNED_BYTE
        });
    }

    function createFramebuffers(pickDepth, context, width, height) {
        destroyTextures(pickDepth);
        destroyFramebuffers(pickDepth);

        createTextures(pickDepth, context, width, height);

        pickDepth.framebuffer = context.createFramebuffer({
            colorTextures : [pickDepth._depthTexture],
            destroyAttachments : false
        });
    }

    function updateFramebuffers(pickDepth, context, depthTexture) {
        var width = depthTexture.width;
        var height = depthTexture.height;

        var texture = pickDepth._depthTexture;
        var textureChanged = !defined(texture) || texture.width !== width || texture.height !== height;
        if (!defined(pickDepth.framebuffer) || textureChanged) {
            createFramebuffers(pickDepth, context, width, height);
        }
    }

    function updateCopyCommands(pickDepth, context, depthTexture) {
        if (!defined(pickDepth._copyDepthCommand)) {
            var fs = 'uniform sampler2D u_texture;\n' +
                     'varying vec2 v_textureCoordinates;\n' +
                     'void main()\n' +
                     '{\n' +
                     '    float depth = texture2D(u_texture, v_textureCoordinates).r;\n' +
                     '    gl_FragColor = vec4(czm_packDepth(depth), 1.0);\n' +
                     '}\n';
            pickDepth._copyDepthCommand = context.createViewportQuadCommand(PassThrough, {
                renderState : context.createRenderState(),
                uniformMap : {
                    u_texture : function() {
                        return pickDepth._textureToCopy;
                    }
                },
                owner : pickDepth
            });
        }

        pickDepth._textureToCopy = depthTexture;
        pickDepth._copyDepthCommand.framebuffer = pickDepth.framebuffer;
    }

    PickDepth.prototype.update = function(context, depthTexture) {
        updateFramebuffers(this, context, depthTexture);
        updateCopyCommands(this, context, depthTexture);
    };

    PickDepth.prototype.executeCopyDepth = function(context, passState) {
        this._copyDepthCommand.execute(context, passState);
    };

    PickDepth.prototype.isDestroyed = function() {
        return false;
    };

    PickDepth.prototype.destroy = function() {
        destroyTextures(this);
        destroyFramebuffers(this);

        this._copyDepthCommand.shaderProgram = defined(this._copyDepthCommand.shaderProgram) && this._copyDepthCommand.shaderProgram.destroy();

        return destroyObject(this);
    };

    return PickDepth;
});