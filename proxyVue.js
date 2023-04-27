const log = console.log.bind(console);

class Vue {
  constructor(option) {
    this.$el = document.querySelector(option.el); //获取挂载节点
    this.$data = option.data;
    this.$methods = option.methods;
    this.deps = {}; //所有订阅者集合 目标格式（一对多的关系）：{msg: [订阅者1, 订阅者2, 订阅者3], info: [订阅者1, 订阅者2]}

    this.observer(this.$data); //调用观察者
    this.compile(this.$el); //调用指令解析器

    // option.mounted.call(this.$data);
  }

  compile(el) {
    let nodes = el.children; //获取挂载节点的子节点
    log("nodes === ", nodes);
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.children.length) {
        this.compile(node); //递归获取子节点
      }

      //当子节点存在 v-model 指令
      if (node.hasAttribute("v-model")) {
        let attrVal = node.getAttribute("v-model"); //获取属性值
        log("attrVal = ", attrVal);
        node.addEventListener(
          "input",
          (() => {
            this.deps[attrVal].push(new Watcher(node, "value", this, attrVal)); //添加一个订阅者
            let thisNode = node;
            return () => {
              this.$data[attrVal] = thisNode.value; //更新数据层的数据
            };
          })()
        );
      }
      //当子节点存在 v-html 指令
      if (node.hasAttribute("v-html")) {
        let attrVal = node.getAttribute("v-html"); //获取属性值
        this.deps[attrVal].push(new Watcher(node, "innerHTML", this, attrVal)); //添加一个订阅者
      }
      // 是 text {{}}
      if (node.innerHTML.match(/{{([^\{|\}]+)}}/)) {
        let attrVal = node.innerHTML.replace(/[{{|}}]/g, ""); //获取插值表达式内容
        this.deps[attrVal].push(new Watcher(node, "innerHTML", this, attrVal)); //添加一个订阅者
      }
      // 当子节点存在 v-on:click 指令
      if (node.hasAttribute("v-on:click")) {
        let attrVal = node.getAttribute("v-on:click"); //获取事件触发的方法名
        node.addEventListener("click", this.$methods[attrVal].bind(this.$data)); //将this指向this.$data
      }
    }
  }

  observer(data) {
    const that = this;
    for (var key in data) {
      that.deps[key] = []; //初始化所有订阅者对象{msg: [订阅者], info: []}
    }
    let handler = {
      get(target, property) {
        return target[property];
      },
      set(target, key, value) {
        let res = Reflect.set(target, key, value);
        var watchers = that.deps[key];
        watchers.map((item) => {
          item.update();
        });
        return res;
      },
    };
    this.$data = new Proxy(data, handler);
  }
}

class Watcher {
  constructor(el, attr, vm, attrVal) {
    this.el = el;
    this.attr = attr;
    this.vm = vm;
    this.val = attrVal;
    this.update(); //更新视图
  }

  update() {
    this.el[this.attr] = this.vm.$data[this.val];
  }
}
