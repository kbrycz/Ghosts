const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)

app.use('/style', express.static(__dirname + '/style'))
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'))

let idNumber = 0

let rooms = []
io.on('connection', (socket) => {
    console.log("someone has connected")

    // STAGES 5-7
    socket.on('createRoom', (roomName) => {
        if (rooms.includes(roomName)) {
            console.log('Error: room name already in use')
        } else {
            rooms.push(roomName)
            socket.join(roomName)
            console.log('created room: ' + roomName);
            io.in(roomName).emit('createRoom', roomName);
        }
    }) 
    socket.on('joinRoom', (roomName) => {
        console.log("inside joinRoom");
        if (rooms.includes(roomName)) {
            rooms.push(roomName)
            socket.join(roomName)
            let obj = {
                'room': roomName,
                'id': socket.id
            }
            io.in(roomName).emit('joinRoom', obj);
        } else {
            console.log('Error: No room with this name')
        }
    }) 

    // STAGE 0
    socket.on('join', (obj) => {
        socket.username = obj.username;
        console.log(socket.username)
        socket.in(obj.roomName).emit('playerJoin',
        {
            'name': socket.username,
            'id': idNumber, 
            'word': '',
            'isGhost': false,
            'votes': 0, 
            'isKicked': false
        });
        io.in(obj.roomName).emit('join', 
        {
            'name': socket.username,
            'id': idNumber, 
            'word': '',
            'isGhost': false,
            'votes': 0,
            'isKicked': false
        });
        idNumber += 1
    })

    // STAGE 1
    socket.on('gameData', (data) => {
        data.words.sort(() => Math.random() - 0.5);
        io.in(data.roomName).emit('gameData', data);
    })
    socket.on('start', (startObj) => {
        io.in(startObj.roomName).emit('start', startObj); 
    })
    socket.on('startingPlayer', (obj) => {
        io.in(obj.roomName).emit('startingPlayer', obj.index); 
    })
    socket.on('startVote', (voteObj) => {
        console.log('There are this many votes: ' + voteObj.votes)
        io.in(voteObj.roomName).emit('startVote', voteObj);
    })
    socket.on('startKick', (voteObj) => {
        console.log('There are this many votes to kick: ' + voteObj.votes)
        io.in(voteObj.roomName).emit('startKick', voteObj);
    })
    socket.on('result', (obj) => {
        console.log('Player being kicked: ' + obj.index)
        io.in(obj.roomName).emit('result', obj.index);
    })
})

http.listen(3000, () => console.log('listening on port 3000'))