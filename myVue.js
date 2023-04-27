const log = console.log.bind(console);

// Observer是一个数据监听器，
// 其实现核心方法就是前文所说的Object.defineProperty( )
function observe(data) {
  if (!data || typeof data !== "object") {
    return;
  }
  Object.keys(data).forEach(function (key) {
    defineReactive(data, key, data[key]);
  });
}

function defineReactive(data, key, val) {
  observe(val); // 递归遍历所有子属性
  var dep = new Dep();
  Object.defineProperty(data, key, {
    enumerable: true,
    configurable: true,
    get: function () {
      // 判断是否需要添加订阅者
      if (Dep.target) {
        // 在这里添加一个订阅者
        dep.addSub(Dep.target);
      }
      return val;
    },
    set: function (newVal) {
      if (val === newVal) {
        return;
      }
      val = newVal;
      console.log(
        "属性" + key + "已经被监听了，现在值为：“" + newVal.toString() + "”"
      );
      dep.notify(); // 如果数据变化，通知所有订阅者
    },
  });
}

// 创建一个可以容纳订阅者的消息订阅器Dep，
// 订阅器Dep主要负责收集订阅者，然后再属性变化的时候执行对应订阅者的更新函数
class Dep {
  constructor() {
    this.subs = [];
  }

  addSub(sub) {
    this.subs.push(sub);
  }

  notify() {
    this.subs.forEach((sub) => {
      sub.update();
    });
  }
}

// 实现 Watcher
class Watcher {
  constructor(vm, exp, cb) {
    // log("in watcher: ", "vm: ", vm, "exp: ", exp, "cb", cb);
    this.vm = vm;
    this.exp = exp;
    this.cb = cb;
    this.value = this.get(); // 将自己添加到订阅器的操作
  }

  update() {
    this.run();
  }

  run() {
    var value = this.vm.data[this.exp];
    var oldVal = this.value;
    if (value !== oldVal) {
      this.value = value;
      this.cb.call(this.vm, value, oldVal);
    }
  }

  get() {
    Dep.target = this; // 缓存自己
    var value = this.vm.data[this.exp]; // 强制执行监听器里的get函数
    Dep.target = null; // 释放自己
    return value;
  }
}

// 解析器Compile, 解析dom节点
class Compile {
  constructor(el, vm) {
    this.vm = vm;
    this.el = document.querySelector(el);
    this.fragment = null;
    this.init();
  }

  init() {
    if (this.el) {
      this.fragment = this.nodeToFragment(this.el);
      this.compileElement(this.fragment);
      this.el.appendChild(this.fragment);
    } else {
      log("Dom元素不存在");
    }
  }

  nodeToFragment(el) {
    var fragment = document.createDocumentFragment();
    var child = el.firstChild;
    while (child) {
      // 将Dom元素移入fragment中
      fragment.appendChild(child);
      child = el.firstChild;
    }
    return fragment;
  }

  compileElement(el) {
    var self = this;
    var childNodes = el.childNodes;
    [].slice.call(childNodes).forEach(function (node) {
      var reg = /\{\{(.*)\}\}/;
      var text = node.textContent;

      if (self.isElementNode(node)) {
        self.compile(node);
      } else if (self.isTextNode(node) && reg.test(text)) {
        // 判断是否是符合这种形式{{}}的指令
        self.compileText(node, reg.exec(text)[1]);
      }

      if (node.childNodes && node.childNodes.length) {
        self.compileElement(node); // 继续递归遍历子节点
      }
    });
  }

  compileText(node, exp) {
    var self = this;
    var initText = this.vm[exp];
    this.updateText(node, initText); // 将初始化的数据初始化到视图中
    new Watcher(this.vm, exp, function (value) {
      // 生成订阅器并绑定更新函数
      self.updateText(node, value);
    });
  }

  updateText(node, value) {
    node.textContent = typeof value == "undefined" ? "" : value;
  }

  isTextNode(node) {
    return node.nodeType == 3;
  }

  isElementNode(node) {
    return node.nodeType == 1;
  }

  compile(node) {
    var self = this;
    var nodeAttrs = node.attributes;
    Array.prototype.forEach.call(nodeAttrs, function (attr) {
      var attrName = attr.name;
      if (self.isDirective(attrName)) {
        var exp = attr.value;
        var dir = attrName.substring(2);
        if (self.isEventDirective(dir)) {
          // on:click 事件指令
          self.compileEvent(node, self.vm, exp, dir);
        } else {
          // v-model 指令
          self.compileModel(node, self.vm, exp, dir);
        }
        node.removeAttribute(attrName);
      }
    });
  }

  compileEvent(node, vm, exp, dir) {
    var eventType = dir.split(":")[1];
    var cb = vm.methods && vm.methods[exp];

    if (eventType && cb) {
      node.addEventListener(eventType, cb.bind(vm), false);
    }
  }

  compileModel(node, vm, exp, dir) {
    var self = this;
    var val = this.vm[exp];
    this.modelUpdater(node, val);
    new Watcher(this.vm, exp, function (value) {
      self.modelUpdater(node, value);
    });

    node.addEventListener("input", function (e) {
      var newValue = e.target.value;
      if (val === newValue) {
        return;
      }
      self.vm[exp] = newValue;
      val = newValue;
    });
  }

  modelUpdater(node, value, oldValue) {
    node.value = typeof value == "undefined" ? "" : value;
  }

  isDirective(attr) {
    return attr.indexOf("v-") == 0;
  }

  isEventDirective(dir) {
    return dir.indexOf("on:") === 0;
  }
}

class SelfVue {
  constructor(options) {
    var self = this;
    this.data = options.data;
    this.vm = this;
    this.methods = options.methods;

    Object.keys(this.data).forEach((key) => {
      self.proxyKeys(key); // 绑定代理属性
    });

    observe(this.data);
    new Compile(options.el, this.vm);
    options.mounted.call(this); // 所有事情处理好后执行mounted函数
  }

  proxyKeys(key) {
    var self = this;
    Object.defineProperty(this, key, {
      enumerable: false,
      configurable: true,
      get: () => {
        return self.data[key];
      },
      set: (newVal) => {
        self.data[key] = newVal;
      },
    });
  }
}
