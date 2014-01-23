$(function(){
  $("[data-action=move")
  .on("mousedown", function (event){
    var $this = $(this);
    send($this.data("camera"), $this.data("direction") + ":start");
  })
  .on("mouseup", function (event){
    var $this = $(this);
    send($this.data("camera"), $this.data("direction") + ":stop");
  });

  $("[data-action=preset").on("click", function (event){
    var $this = $(this);
    send($this.data("camera"), "preset:" + $this.data("preset"));
  });

  function send (camera, command) {
    $.get("/command/" + camera + "/" + command);
  }
});