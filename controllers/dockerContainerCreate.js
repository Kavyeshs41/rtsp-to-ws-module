var dotenv = require('dotenv').config();
var fs = require('fs');
var socket = process.env.DOCKER_SOCKET_URL || '/var/run/docker.sock';
var stats  = fs.statSync(socket);
var Docker = require('dockerode');
var getPort = require('get-port');
var pubIp = require('public-ip');
var urlValidationRegex = /^(rtsp):\/\/[^ "]+$/;
var authTokenValidation = process.env.AUTH_TOKEN


if (!stats.isSocket()) {
  throw new Error('Are you sure the docker is running?');
}

class dockerContainerCreate {
    
    async createContainer(req, res, next) {
        var portTobeUsed = await getPort({port: getPort.makeRange(35010, 35510)});
        var hostPubIp = await pubIp.v4();
        var docker = new Docker({ socketPath: socket });
        
        // Catch 4XX Errors
        if (!req.body.stream_url) return res.status(400).send({"error": "Please pass stream URL"})
        if (!urlValidationRegex.test(req.body.stream_url)) return res.status(400).send({"error": "URL is not in specified format"})
        if (!req.body.auth_token) return res.status(400).send({"error": "Token not in body"})
        if (authTokenValidation !== req.body.auth_token) return res.status(400).send({"error": "Token not valid"})
        
        // Catch 5XX Errors
        if (!docker) return res.stats(500).send('Docker daemon is not running');
        if (!portTobeUsed) return res.status(500).send({"error": "No Free Ports Available"})
        if (!hostPubIp) return res.status(500).send({"error": "Error in finding Public IP"})
        
        var wsString = `ws://${hostPubIp}:${portTobeUsed}`
        var dockerEnvURL = `URL=${req.body.stream_url}`
        var dockerEnvWSPORT = `WS_PORT=9999`
        var dockerEnv = [dockerEnvURL, dockerEnvWSPORT]
        
        await docker.pull(process.env.IMAGE_NAME, function(err, stream){
            docker.modem.followProgress(stream, onFinished);
            function onFinished(err, output) {
                docker.createContainer({
                    Image: process.env.IMAGE_NAME,
                    ExposedPorts: { "9999/tcp": {} },
                    HostConfig: {
                        PortBindings: {"9999/tcp": [{"HostPort": portTobeUsed+""}]}
                    },
                    Env: dockerEnv
                }, function (err, container) {
                    container.start();
                })
            }
        });
        return res.status(200).send({"websocket_url" : wsString})
    }

    async listContainer(req, res, next) {
        var containerNames = []
        docker.listContainers({all: true}, function(err, containers) {
            containers.forEach( e => {
                if(e.State == "running" && e.Names)
                    containerNames.push(e.Names[0].replace(/\//g, ""))
            })
            res.send(containerNames)
        });
    }

}

module.exports = new dockerContainerCreate();