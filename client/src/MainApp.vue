<template>
  <main>
    <div v-if="notFound">
      <h1>This page could not be found</h1>
    </div>
    <Login v-if="!loggedIn && !notFound" @attempt-login="pw => performLogin(boardId, pw)" :errorMessage="loginError"></Login>
    <template v-if="loggedIn && !notFound">
      <div v-if="board === null"><h1>Loading...</h1></div>
      <div v-else>
        <h1>{{ board.name }}</h1>

        <h2 v-if="avatarId === null">The currently selected avatar has no controls on this board</h2>

        <template v-if="currentAvatar !== null">
          <div class="text">Avatar: <b>{{ currentAvatar.name }}</b></div>

          <div class="controls">
            <div v-for="control in controlsOrdered" :key="control.id" class="control-wrapper">
              <div 
                v-if="control.types.control === 'button'" 
                class="control control-button"
                :class="{ 'clicked': control.clicked }"
                @click="performAction(control)"
              >
                <div class="title-wrapper"><div class="title">{{ control.label }}</div></div>
                <img v-if="control.icon !== null" :src="'/i/' + control.icon" class="background-icon" />
              </div>
              <div
                v-else-if="control.types.control === 'toggle'"
                class="control control-toggle"
                :class="{ 'toggled': control.isToggled(avatarParameterValues) }"
                @click="performAction(control)"
              >
                <img v-if="control.icon !== null" :src="'/i/' + control.icon" class="background-icon" />
                <div class="title-wrapper"><div class="title">{{ control.label }}</div></div>
                <div class="slider-wrapper"><div class="slider"></div></div>
              </div>
              <div v-else-if="control.types.control === 'range'" class="control control-range">
                <div class="title-wrapper"><div class="title">{{ control.label }}</div></div>
                <RadialMenu
                  style="width: 100%; height: 100%" 
                  v-model="avatarParameterValues[control.parameterName]" 
                  @update:modelValue="v => setParamValue(control, v)"
                ></RadialMenu>
                <img v-if="control.icon !== null" :src="'/i/' + control.icon" class="background-icon" />
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </main>
</template>

<script>
import axios from "axios";
import { io } from "socket.io-client";

import LoginMixin from "./lib/LoginMixin";
import { SocketIoAvatarParamControl } from "./lib/SocketIoAvatarParamControl";

import Login from "./components/Login.vue";
import RadialMenu from "./components/RadialMenu.vue";

export default {
  mixins: [ LoginMixin ],
  components: { Login, RadialMenu },
  data() {
    return {
      board: null,
      avatarId: null,
      avatarParameterValues: {},
      controls: {},
    }
  },
  computed: {
    boardId() {
      if (window.location.pathname === "/") {
        return "default";
      }

      const m = window.location.pathname.match(/^\/b\/((?:\w|-)+)/);
      if (m == null) return null;
      return m[1];
    },
    currentAvatar() {
      if (this.board == null || this.avatarId == null) return null;
      return this.board.avatars[this.avatarId];
    },
    controlsOrdered() {
      if (this.currentAvatar == null) return null;

      return this.currentAvatar.controlOrder.map(cid => {
        return this.controls[cid];
      });
    },
  },
  watch: {
    async loggedIn() {
      if (this.loggedIn) {
        await this.updateBoard();
        this.setupSocket();
      }
    },
  },
  methods: {
    async updateBoard() {
      if (!this.loggedIn) return;

      const resp = await axios.get(`/api/b/${this.boardId}/full`);
      this.board = resp.data.board;
    },
    setupSocket() {
      if (this.boardId == null || !this.loggedIn) return;
      this.$options.socket = io({
        query: {
          target: this.boardId,
        },
        reconnection: true,
      });

      // msg = { id }
      this.$options.socket.on("avatar", msg => {
        // console.log("avatar", msg);
        this.avatarId = (msg !== null) ? msg.id : null;
        this.avatarParameterValues = {}; // reset value cache
        this.controls = {};

        if (this.avatarId !== null) {
          // create avatar parameter controls
          for (let controlId in this.board.avatars[this.avatarId].controls) {
            this.controls[controlId] = new SocketIoAvatarParamControl(this.board.avatars[this.avatarId].controls[controlId], this.avatarId);
          }
        }
      });

      // msg = { name, value, avatar }
      this.$options.socket.on("parameter", msg => {
        // console.log("parameter", msg);
        this.avatarParameterValues[msg.name] = msg.value;
      });
    },
    performAction(control) {
      control.performAction(this.$options.socket).catch(err => {
        console.error(err);
      });
    },
    setParamValue(control, val) {
      control.setValue(this.$options.socket, val).catch(err => {
        console.error(err);
      });
    }
  },
  async created() {
    this.$options.socket = null;

    if (this.boardId !== null) {
      await this.checkLogin(this.boardId);

      const presetPw = this.getPasswordParam();
      if (!this.loggedIn && presetPw !== null) {
        await this.performLogin(this.boardId, presetPw);
      }

      // await this.updateBoard();
      // this.setupSocket();
    } else {
      this.notFound = true;
    }
  }
}
</script>

<style lang="scss">
@import "assets/style";

main {
  display: flex;
  flex-direction: column;
  align-items: center;
}

h1, h2, div.text {
  margin-top: 0px;
  text-align: center;
}

.controls {
  margin-top: 20px;
  // width: 800px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  // grid-template-columns: 1fr 1fr 1fr;
  // grid-gap: 20px;

  .control-wrapper {
    box-sizing: border-box;
    // aspect-ratio: 1;
    position: relative;
    width: 250px;
    height: 250px;
    margin: 10px;

    @media (max-width: 810px) {
      width: 150px;
      height: 150px;
    }

    .control {
      width: 100%;
      height: 100%;
      border-style: solid;
      border-color: #343434;
      border-width: 1px;
      border-radius: 20%;
      position: relative;
      overflow: hidden;

      .title-wrapper {
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        pointer-events: none;

        .title {
          font-size: 25px;
          max-width: 75%;
          word-wrap: break-word;
          text-align: center;
          user-select: none;
        }
      }

      .background-icon {
        position: absolute;
        top: 10px;
        left: 10px;
        width: calc(100% - 20px);
        height: calc(100% - 20px);
        opacity: 0.3;
        z-index: -10;
      }

      &.control-button, &.control-toggle {
        cursor: pointer;
        
        &:hover {
          background-color: rgba(35, 35, 35, 0.7);
        }
      }

      &.control-button {
        &.clicked {
          background-color: $main_light;
        }
      }

      &.control-toggle {
        .slider-wrapper {
          box-sizing: border-box;
          z-index: 10;
          height: 100%;
          width: 40%;
          padding: 5%;
          transition: transform 0.2s;

          .slider {
            background-color: $red_dark;
            width: 100%;
            height: 100%;
            border-radius: 100%/33.3333%;
            transition: background-color 0.2s;
          }
        }

        &.toggled {
          .slider-wrapper {
            transform: translateX(150%);

            .slider {
              background-color: $green_dark;
            }
          }
        }
      }

      &.control-range {

      }
    }
  }
}
</style>
