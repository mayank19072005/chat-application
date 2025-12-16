const mongoose = require('mongoose');
const Chat = require('./models/chat');

main().then((res)=>{
    console.log(res)
})
.catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/test');
}

let newchat = [{
    from:'iron man',
    to : 'morgan stark',
    message : 'I LOVE YOU 3000 TIMES',
    create_to : new Date() 
},
{
    from : 'captain america',
    to : 'falcon',
    message: 'on your left',
    create_to : new Date()
},
{
    from : 'hulk',
    to : 'loki',
    message: 'smash',
    create_to : new Date()
}]

Chat.insertMany(newchat);