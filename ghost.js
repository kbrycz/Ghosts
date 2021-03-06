// -------------------VARIABLES-----------------------

const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http, {
    pingInterval: 10000,
    pingTimeout: (1000 * 60) * 30,
    cookie: false
})
let idNumber = 0
let rooms = []
let hosts = {}

// -------------------SET UP ALL FILES------------------------

app.use('/style', express.static(__dirname + '/style'))
app.use('/images', express.static(__dirname + '/images'))
app.use('/js', express.static(__dirname + '/js'))
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'))


// -------------------------------------ONCE A SOCKET HAS CONNECTED--------------------------------------

io.on('connection', (socket) => {

    // -------------------Room socket functions-------------------------------

    socket.on('createRoom', (roomName) => {
        if (rooms.includes(roomName)) {
            console.log('Error: room name already in use')
        } else {
            rooms.push(roomName)
            socket.join(roomName)
            let obj = {
                'room': roomName,
                'id': socket.id
            }
            hosts[socket.id] = roomName;
            console.log('created room: ' + roomName);
            io.in(roomName).emit('createRoom', obj);
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
            socket.emit('noRoom', roomName);
        }
    }) 
    socket.on('leaveRoom', (obj) => {
        socket.leave(obj.room);
        if (obj.isHost) {
            io.in(obj.room).emit('hostLeft', obj.socketid);
        } else {
            io.in(obj.room).emit('leaveRoom', obj.socketid);
        }
    })
    socket.on('join', (obj) => {
        socket.username = obj.username;
        console.log(socket.username)
        io.in(obj.roomName).emit('playerJoin',
        {
            'socketid': socket.id,
            'name': socket.username,
            'id': idNumber, 
            'word': '',
            'isGhost': false,
            'votes': 0, 
            'isKicked': false,
            'hasGuessed': false,
            'guess': '',
            'votedIndex': -1,
        });
        io.in(obj.roomName).emit('join', 
        {
            'socketid': socket.id,
            'name': socket.username,
            'id': idNumber, 
            'word': '',
            'isGhost': false,
            'votes': 0,
            'isKicked': false,
            'hasGuessed': false,
            'guess': '',
            'votedIndex': -1,
        });
        idNumber += 1
    })

    // -------------------Leaving socket functions----------------------------

    socket.on('disconnect', (reason) => {
        console.log('User has disconnected');
        console.log(reason);
        console.log(socket.id)
        if (socket.id in hosts) {
            console.log('host has disconnected');
            io.in(hosts[socket.id]).emit('hostDisconnected');
            var index = rooms.indexOf(hosts[socket.id]);
            if (index !== -1) {
                rooms.splice(index, 1);
            }
            delete hosts[socket.id];
        } else {
            io.emit('leaveRoom', socket.id);
        }
    })
    socket.on('everyoneLeave', (room) => {
        console.log("exiting room");
        socket.leave(room);
        if (socket.id in hosts) {
            console.log('host has disconnected');
            io.in(hosts[socket.id]).emit('hostDisconnected');
            var index = rooms.indexOf(hosts[socket.id]);
            if (index !== -1) {
                rooms.splice(index, 1);
            }
            delete hosts[socket.id];
        }
    })

    // -------------------Game creating socket functions----------------------------

    socket.on('deleteGame', (obj) => {
        console.log("deleting game");
        io.in(obj.roomName).emit('deleteGame', obj);
    })
    socket.on('updateInformation', (obj) => {
        io.in(obj.roomName).emit('updateInformation', obj);
    })
    socket.on('gameData', (data) => {
        data.words.sort(() => Math.random() - 0.5);
        io.in(data.roomName).emit('gameData', data);
    })
    socket.on('start', (startObj) => {
        io.in(startObj.roomName).emit('start', startObj); 
    })

    // -------------------Ghost stage socket functions----------------------------

    socket.on('startingPlayer', (obj) => {
        io.in(obj.roomName).emit('startingPlayer', obj.index); 
    })

    // -------------------Player stage socket functions----------------------------

    socket.on('startVote', (voteObj) => {
        console.log('There are this many votes: ' + voteObj.votes)
        io.in(voteObj.roomName).emit('startVote', voteObj);
    })
    socket.on('startKick', (voteObj) => {
        console.log('There are this many votes to kick: ' + voteObj.votes)
        io.in(voteObj.roomName).emit('startKick', voteObj);
    })

    // ------------------Result stage socket functions----------------------------

    socket.on('return', (room) => {
        console.log("Returning to menu");
        io.in(room).emit('return');
    })
    socket.on('result', (obj) => {
        console.log('Player being kicked: ' + obj.index)
        io.in(obj.roomName).emit('result', obj.index);
    })
    socket.on('ghostGuessed', (obj) => {
        io.in(obj.room).emit('ghostGuessed', obj.guess);
    })

    // ------------------Host socket functions----------------------------

    socket.on('advance', (room) => {
        console.log("Host advancing game");
        io.in(room).emit('advance');
    })
})

// -----------------LISTEN ON PORT 80-----------------

http.listen(8081, () => console.log('listening on port 8081'))