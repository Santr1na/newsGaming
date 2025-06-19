const mongoose = require('mongoose');

   const newsSchema = new mongoose.Schema({
     title: { type: String, required: true },
     description: String,
     link: { type: String, required: true, unique: true },
     pubDate: { type: Date, required: true },
     image: String,
     author: String,
     category: {
       type: String,
       enum: ['rumors', 'recommendations', 'polls', 'soon', 'update'],
       required: true
     }
   });

   module.exports = mongoose.model('News', newsSchema);