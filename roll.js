//pixels queue|list
//push timeline queue for memory limit
//must use linked list because of uncertainty of length of queue
//at the pixel
//solid bitmap image

var canvasWidth = 500;
var canvasHeight = 500;
var canvasSize = canvasWidth * canvasHeight;
var canvas, ctx;

var maxPushTimeLine = 1 << 24; //16 mils of pixel data stored

//stylus events
var preMouseX, preMouseY;
var isMouseDown = false;

//control events
var eraseClicked = false;

var commands = [];
var cmdIndex = 0;

//-----------------------------PIXEL QUEUE OBJECTS------------------------------
function pixelQueueItem() {
  this.r = 0;
  this.g = 0;
  this.b = 0;
  this.a = 0;
  this.next = null;
  this.prev = null;
}

function pixelQueueMetaItem() {
  this.bottom = null;
  this.top = null;
  this.length = 0;
}

var queueMetaAtPixel = [];
var pushTimeLine = [];
var redoStack = [];
//is also a wrapped around queue
//storing push timeline, to be used to when undo
var pushTimeLineTop = 0;
var pushTimeLineBottom = 0;
var pushTimeLineLength = 0;
var solidImageData = [];

var timerID;


//---------------------------TOOL VARIABLES-------------------------------------
var tool;
var eraseRadius = 0;
var eraseLevel = [];


canvas = document.getElementById("mainCanvas");
canvas.setAttribute("width", canvasWidth);
canvas.setAttribute("height", canvasHeight);
$("#canvasContainer").attr("width", canvasWidth);
// $("#canvasContainer").css("margin", "auto");


function wrappedQueue() {
  this.top = 0;
  this.bottom = 0;
  this.length = 0;
}

function pixelQueueClass(canvas) {
  //Each pixelQueue instance will have
  //a canvas which it is bound to
  //a time line for in/out record
  //pixelqueues which associate each pixel on the bound canvas with a queue


  //time line
  this.timeLine = new wrappedQueue();
  //
  this.redoStack = new wrappedQueue();
  //queue
  this.queueMetaAtPixel = [];


  this.canvas = canvas;
  this.width = canvas.width;
  this.height = canvas.height;

  this.solidImageData = null;
}

pixelQueueClass.prototype = {
  push: function(data, index) {


    var queueMeta = this.queueMetaAtPixel[index >> 2];
    var item = new pixelQueueItem();
    item.r = data[0];
    item.g = data[1];
    item.b = data[2];
    item.a = data[3];

    if (queueMeta.length > 0) {
      //if queue had some item alrd -> connect
      item.prev = queueMeta.top;
      queueMeta.top.next = item;
    } else {
      queueMeta.bottom = item;
    }
    queueMeta.top = item;
    queueMeta.length++;

    //--------timeline queue----------

    this.timeLine.length++;
    //if TimeLine over load -> pop from bottom
    if (this.timeLine.length > maxPushTimeLine) {
      this.dQFirst();
    }

    this.timeLine.top = (this.timeLine.top + 1) % maxPushTimeLine;
    if (this.timeLine.length == 1) {
      //virgin queue
      //first time push
      this.timeLine.bottom = this.timeLine.top;
    }
    //push to top
    this.timeLine[this.timeLine.top] = index >> 2;
    //if timeline pushed firstime

  },
  dQLast: function() {
    //call when queue over flow
    //take the bottom of pushtimeline, pop it out
    //index is the index of image queue just popped
    var index = this.timeLine.push[this.timeLine.bottom];
    var queueMeta = this.queueMetaAtPixel[index];

    var poppedItem = queueMeta.bottom;
    if (queueMeta.length == 1) {
      queueMeta.bottom = null;
      queueMeta.top = null;
    } else {
      queueMeta.bottom = poppedItem.next;
      queueMeta.bottom.prev = null;
    }
    queueMeta.length--;
    //update pushtimeline
    this.timeLine.bottom = (this.timeLine.bottom + 1) % maxPushTimeLine;
    this.timeLine.length--;

    //solidify: add to the frozen | not undo-able array
    //if all queue vaporized, this one will appear
    this.solidImageData[index] = poppedItem;
  },
  dQFirst: function() {
    //--------timeline queue----------

    var canvasIndex = this.timeLine[this.timeLine.top];

    var queueMeta = this.queueMetaAtPixel[canvasIndex];

    var poppedItem = queueMeta.top;
    if (queueMeta.length == 1) {
      queueMeta.bottom = null;
      queueMeta.top = null;
    } else {
      queueMeta.top = poppedItem.prev;
      queueMeta.top.next = null;
    }

    queueMeta.length--;
    //-----------pixel queue----------
    this.timeLine.top = (this.timeLine.top - 1 + maxPushTimeLine) % maxPushTimeLine;
    this.timeLine.length--;
    return canvasIndex;
  }
}

function pixelQueuesPush(data, index) {
  //-----------pixel queue-----------
  var queueMeta = queueMetaAtPixel[index >> 2];
  var item = new pixelQueueItem();
  item.r = data[0];
  item.g = data[1];
  item.b = data[2];
  item.a = data[3];

  if (queueMeta.length > 0) {
    //if queue had some item alrd -> connect
    item.prev = queueMeta.top;
    queueMeta.top.next = item;
  } else {
    queueMeta.bottom = item;
  }
  queueMeta.top = item;
  queueMeta.length++;

  //--------timeline queue----------

  pushTimeLineLength++;
  //if TimeLine over load -> pop from bottom
  if (pushTimeLineLength > maxPushTimeLine) {
    pixelQueuesPopBottom();
  }

  pushTimeLineTop = (pushTimeLineTop + 1) % maxPushTimeLine;

  //if timeline pushed firstime
  if (pushTimeLineLength == 1) {
    //virgin queue
    //first time push
    pushTimeLineBottom = pushTimeLineTop;
  }
  //push to top
  pushTimeLine[pushTimeLineTop] = index >> 2;


}

function pixelQueuesPopBottom() {
  //call when queue over flow
  //take the bottom of pushtimeline, pop it out
  //index is the index of image queue just popped
  var index = pushTimeLine[pushTimeLineBottom];
  var queueMeta = queueMetaAtPixel[index];
  var poppedItem = queueMeta.bottom;

  if (queueMeta.length == 1) {
    queueMeta.bottom = null;
    queueMeta.top = null;
  } else {
    queueMeta.bottom = poppedItem.next;
    queueMeta.bottom.prev = null;
  }
  queueMeta.length--;
  //update pushtimeline
  pushTimeLineBottom = (pushTimeLineBottom + 1) % maxPushTimeLine;
  pushTimeLineLength--;

  //solidify: add to the frozen | not undo-able array
  //if all queue vaporized, this one will appear
  solidImageData[index] = poppedItem;
}

function pixelQueuesPopTop() {

  //-----------pixel queue----------
  var index = pushTimeLine[pushTimeLineTop];
  var queueMeta = queueMetaAtPixel[index];
  var poppedItem = queueMeta.top;
  if (queueMeta.length == 1) {
    queueMeta.bottom = null;
    queueMeta.top = null;
  } else {
    queueMeta.top = poppedItem.prev;
    queueMeta.top.next = null;
  }
  queueMeta.length--;



  //--------timeline queue----------
  pushTimeLineTop = (pushTimeLineTop - 1 + maxPushTimeLine) % maxPushTimeLine;
  pushTimeLineLength--;
  return index;

  //--------redo stack--------------
  redoStack.push(poppedItem);
}

function init() {

  ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFF";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, canvasHeight);
  ctx.lineTo(canvasWidth, canvasHeight);
  ctx.lineTo(canvasWidth, 0);
  ctx.lineTo(0, 0);
  ctx.strokeStyle = "#EEE";
  ctx.stroke();

  var initData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

  for (var i = 0; i < canvasSize; i++) {
    queueMetaAtPixel[i] = new pixelQueueMetaItem();
    solidImageData[i] = new pixelQueueItem();
    solidImageData[i].r = initData.data[i << 2];
    solidImageData[i].g = initData.data[(i << 2) + 1];
    solidImageData[i].b = initData.data[(i << 2) + 2];
    solidImageData[i].a = initData.data[(i << 2) + 3];
  }
  //canvas mouseevents

  isMouseDown = false;
  window.addEventListener('mousemove', canvasMouseMove, false);
  window.addEventListener('mouseup', canvasMouseUp, false);
  window.addEventListener('mousedown', canvasMouseDown, false);


  //controls

  //eraser


  //roll event
  function disable(btn) {
    if (btn == "all") {
      $("#buttonHolder").find("button").each(function() {
        var thisBtn = $(this);
        thisBtn.css("background", "#000");
        thisBtn.css("color", "#FFF");
        thisBtn.hover(
          function() {
            thisBtn.css("background", "#CCC");
            thisBtn.css("color", "#000");
          },
          function() {
            thisBtn.css("background", "#000");
            thisBtn.css("color", "#FFF");
          }
        );
      });
    } else {
      btn.css("background", "#000");
      btn.css("color", "#FFF");
      btn.hover(
        function() {
          btn.css("background", "#CCC");
          btn.css("color", "#000");
        },
        function() {
          btn.css("background", "#000");
          btn.css("color", "#FFF");
        }
      );
    }
  }

  function activate(btn) {
    btn.css("background", "#EEE");
    btn.css("color", "#000");

    btn.hover(
      function() {
        btn.css("background", "#CCC");
        btn.css("color", "#000");
      },
      function() {
        btn.css("background", "#EEE");
        btn.css("color", "#000");
      }
    );
  }



  $("#backward").hover(
    function() {
      //freeze canvas

      //perform rolling back
      //100pixel per 20 milli sec
      //refresh rate ~50fps
      clearInterval(timerID);
      timerID = setInterval(function() {
        rollback(30);
      }, 3);
    },
    function() {
      //end hover
      clearInterval(timerID);
    }
    //initate rolling
  );
  $("#forward").hover(
    function() {
      //freeze canvas

      //perform rolling back
      //100pixel per 20 milli sec
      //refresh rate ~50fps
      clearInterval(timerID);
      timerID = setInterval(function() {
        rollback(20)
      }, 3);
    },
    function() {
      //end hover
      clearInterval(timerID);
    }
    //initate rolling
  );
  //jump event
  $("#jump").click(function() {

  });
  //brush
  $("#brush").click(function() {
    var btn = $(this);
    if ((tool) && (tool.type == "brush")) {
      tool = null;
      disable(btn);
    } else {
      disable("all");
      tool = {
          type: "brush"
        }
        //clear all
      activate(btn);
    }
  });
  //eraser
  $("#eraser").on("click", function() {
    var btn = $(this);
    if ((tool) && (tool.type == "eraser")) {
      tool = null;
      disable(btn);
    } else {
      disable("all");
      tool = {
        type: "eraser"
      }
      activate(btn);
    }
  });

  //init tool
  activate($("#brush"));
  tool = {
    type: "brush"
  };

  setInterval(executeCommands, 5);
}

function canvasMouseUp(e) {
  isMouseDown = false;
  console.log(pushTimeLineTop);
}

function canvasMouseDown(e) {


  isMouseDown = true;
  //where the love begins
  var mouseX, mouseY;
  //start mouse command record

  //end mouse command cord

  var rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;

  //init preMouse
  preMouseX = mouseX;
  preMouseY = mouseY;
}

function canvasMouseMove(e) {
  //lert(isMouseDown);
  if ((!isMouseDown) || (!tool)) return;

  var rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;

  if (tool.type == "brush")
    drawLine(mouseX, mouseY);
  else
  if (tool.type == "eraser")
    erase(mouseX, mouseY);
}

//--------------------ALL EVENTS - CONTROLLER---------------------
$(function() {
  init();
});



//slow solution: subtract subsequent frames
//faster solution: rewritten stroke functions to take exactly the amount changed only
//with Bresenham's line algorithm and Xiaolin Wu's line algorithm

//drawLine slow Solution

function drawLine(mouseX, mouseY) {

  commands.push({
    type: "line",
    from: {
      x: preMouseX,
      y: preMouseY
    },
    to: {
      x: mouseX,
      y: mouseY
    }
  });
  preMouseX = mouseX;
  preMouseY = mouseY;
}

//roll back
function rollback(amountToPop) {
  //if not finish drawing -> return
  if (commands.length) return;

  var amountPopped = 0;
  var index;
  var tempPx = ctx.createImageData(1, 1);
  var tempData = tempPx.data;
  var data;
  //console.log('timeLineTop:', pushTimeLineTop);
  while ((pushTimeLineLength > 0) && (amountPopped < amountToPop)) {
    //if (!pixelQueuesPopTop()) break;
    index = pixelQueuesPopTop();
    if (queueMetaAtPixel[index].length > 0)
      data = queueMetaAtPixel[index].top;
    else
      data = solidImageData[index];
    tempData[0] = data.r;
    tempData[1] = data.g;
    tempData[2] = data.b;
    tempData[3] = data.a;
    ctx.putImageData(tempPx, index % canvas.width, (index / canvas.width) | 0);
    amountPopped++;
  }
}

function rollforward(amountToPush) {

}

function jumpBack() {

}

function erase() {

}

function executeCommands() {
  function findCirclePoints(x0, y0, radius, resultArr) {
    var x = radius,
      y = 0;
    var xChange = 1 - (randius << 1);
    var yChange = 0;
    var rErr = 0;

    while (x <= y) {
      resultArr.push(x + x0, y + y0);
      resultArr.push(y + x0, x + y0);
      resultArr.push(-x + x0, y + y0);
      resultArr.push(-y + x0, x + y0);

      resultArr.push(-x + x0, -y + y0);
      resultArr.push(-y + x0, -x + y0);
      resultArr.push(x + x0, -y + y0);
      resultArr.push(y + x0, -x + y0);

      y++;
      rErr += yChange;
      yChange += 2;
      if (((rErr << 1) + xChange) > 0) {
        x--;
        rErr += xChange;
        xChange += 2;
      }
    }
  }

  function line(x0, y0, x1, y1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);

    var sx, sy;
    if (x0 < x1) sx = 1;
    else sx = -1;
    if (y0 < y1) sy = 1;
    else sy = -1;
    var err = dx - dy;
    var e2;
    var index;
    var rValue = Math.round(Math.random() * 200);
    var color = {
      r: rValue,
      g: rValue,
      b: rValue,
      a: 255
    }

    while (true) {
      if ((x0 > 0) && (x0 < canvas.width) && (y0 > 0) && (y0 < canvas.height)) {
        index = (x0 + y0 * canvas.width) << 2;
        d[0] = color.r;
        d[1] = color.g;
        d[2] = color.b;
        d[3] = color.a;
        pixelQueuesPush(d, index);
        ctx.putImageData(tempPixel, x0, y0);
      }

      if ((x0 == x1) && (y0 == y1)) break;
      e2 = err << 1;
      if (e2 > -dy) {
        err = err - dy;
        x0 = x0 + sx;
      }
      if (e2 < dx) {
        err = err + dx;
        y0 = y0 + sy;
      }
    }
  }

  var tempPixel = ctx.createImageData(1, 1);
  var d = tempPixel.data;

  if (commands.length > 0) {
    if (cmdIndex > commands.length - 1) {
      commands = [];
      cmdIndex = 0;
    } else {
      var request = commands[cmdIndex];
      //execute comand
      if (request.type == "line") {
        var x0 = request.from.x,
          y0 = request.from.y,
          x1 = request.to.x,
          y1 = request.to.y;

        line(x0, y0, x1, y1);
        line(x0 + 1, y0, x1 + 1, y1);
        line(x0, y0 + 1, x1, y1 + 1);
        line(x0 - 1, y0, x1 - 1, y1);
        line(x0, y0 - 1, x1, y1 - 1);
      } else if (request.type == "erase") {
        var x0 = request.from.x,
          y0 = request.from.y,
          x1 = request.to.x,
          y1 = request.to.y;
        var circlePoints = [];
        findCirclePoints(x0, y0, eraseRadius, circlePoints);

        //find appropriate border

        //from border to border

        //draw a circle at x0y0 if previous request x1y1 is different


      }

      cmdIndex++;
    }
  }
  /*
  for (var i = 0; i < commands.length; i++){
      var request = commands[i];
      if (request.type == "line"){
          var x0 = request.from.x,
              y0 = request.from.y,
              x1 = request.to.x,
              y1 = request.to.y;

          line(x0, y0, x1, y1);
          line(x0 + 1, y0, x1 + 1, y1);
          line(x0, y0 + 1, x1, y1 + 1);
          line(x0 - 1, y0, x1 - 1, y1);
          line(x0, y0 - 1, x1, y1 - 1);
      }
      else if (request.type == "erase"){
          var x0 = request.from.x,
              y0 = request.from.y,
              x1 = request.to.x,
              y1 = request.to.y;

          erase(x0, y0, x1, y1);
          //define edge



          //from edge to edge

          //draw a circle at x1y1


      }
  }

  commands = [];*/
}






//function setPixel(imageData, x, y, r, g, b, a){
//    var index = (x + y * imageData.width) * 4;
//    imageData.data[index+0] = r;
//    imageData.data[index+1] = g;
//    imageData.data[index+2] = b;
//    imageData.data[index+3] = a;
//}
//
//function setPixel(imageData, index, r, g, b, a){
//    imageData.data[index+0] = r;
//    imageData.data[index+1] = g;
//    imageData.data[index+2] = b;
//    imageData.data[index+3] = a;
//}
//
//function isEqual(imageData1, imageData2, index){
//    if ((imageData1.data[index+0] == imageData2.data[index+0]) &&
//        (imageData1.data[index+1] == imageData2.data[index+1]) &&
//        (imageData1.data[index+2] == imageData2.data[index+2]) &&
//        (imageData1.data[index+3] == imageData2.data[index+3])) return true;
//    return false;
//}
