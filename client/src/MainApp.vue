<template>
  <main>
    <div v-if="notFound">
      <h1>This page could not be found</h1>
    </div>
    <Login v-if="!loggedIn && !notFound" @attempt-login="pw => performLogin(boardId, pw)" :errorMessage="loginError" />
    <template v-if="loggedIn && !notFound">
      <div v-if="board === null"><h1>Loading...</h1></div>
      <div v-else>
        <h1>{{ board.name }}</h1>

        <h2 v-if="avatarId === null">The currently selected avatar has no controls on this board</h2>

        <template v-if="currentAvatar !== null">
          <div class="text">Avatar: <b>{{ currentAvatar.name }}</b></div>

          <div class="group" v-for="group in groups" :key="group.id">
            <div class="group-header" v-if="groups.length > 1" @click="toggleGroupCollapse(group.id)">
              <div class="title" v-if="group.id == 'default'">Default</div>
              <div class="title" v-else-if="group.name.length == 0">Unnamed group</div>
              <div class="title" v-else>{{ group.name }}</div>

              <div class="collapse-indicator" :class="{ 'collapsed': collapsedGroups.has(group.id) }">
                <IconCollapse class="icon" />
              </div>
            </div>
            <div class="controls" :class="{ 'collapsed': collapsedGroups.has(group.id) }" ref="groupControls">
              <div v-for="controlId in group.controls" :key="controlId" class="control-wrapper">
                <div 
                  v-if="controls[controlId].types.control === 'button'" 
                  class="control control-button"
                  :class="{ 'clicked': controls[controlId].clicked }"
                  @click="performAction(controls[controlId])"
                >
                  <div class="title-wrapper"><div class="title">{{ controls[controlId].label }}</div></div>
                  <img v-if="controls[controlId].icon !== null" :src="'/i/' + controls[controlId].icon" class="background-icon" />
                </div>
                <div
                  v-else-if="controls[controlId].types.control === 'toggle'"
                  class="control control-toggle"
                  :class="{ 'toggled': controls[controlId].isToggled(avatarParameterValues) }"
                  @click="performAction(controls[controlId])"
                >
                  <img v-if="controls[controlId].icon !== null" :src="'/i/' + controls[controlId].icon" class="background-icon" />
                  <div class="title-wrapper"><div class="title">{{ controls[controlId].label }}</div></div>
                  <div class="slider-wrapper"><div class="slider"></div></div>
                </div>
                <div v-else-if="controls[controlId].types.control === 'range'" class="control control-range">
                  <div class="title-wrapper"><div class="title">{{ controls[controlId].label }}</div></div>
                  <RadialMenu
                    style="width: 100%; height: 100%" 
                    v-model="avatarParameterValues[controls[controlId].parameterName]" 
                    @update:modelValue="v => setParamValue(controls[controlId], v)"
                  />
                  <img v-if="controls[controlId].icon !== null" :src="'/i/' + controls[controlId].icon" class="background-icon" />
                </div>
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
import { CaretDown } from "@vicons/fa";

import LoginMixin from "./lib/LoginMixin";
import { SocketIoAvatarParamControl } from "./lib/SocketIoAvatarParamControl";

import Login from "./components/Login.vue";
import RadialMenu from "./components/RadialMenu.vue";

export default {
  mixins: [ LoginMixin ],
  components: {
    Login,
    RadialMenu,
    IconCollapse: CaretDown,
  },
  data() {
    return {
      board: null,
      avatarId: null,
      avatarParameterValues: {},
      controls: {},
      collapsedGroups: new Set(),
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
    groups() {
      if (this.currentAvatar == null) return null;

      return this.currentAvatar.groupOrder.map(groupId => {
        return { ...this.currentAvatar.groups[groupId], id: groupId };
      });
    },
  },
  watch: {
    async loggedIn() {
      if (this.loggedIn) {
        await this.updateBoard();
        this.setupSocket();
      }
    }
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
    },
    toggleGroupCollapse(groupId) {
      if (this.collapsedGroups.has(groupId)) {
        this.collapsedGroups.delete(groupId);
      } else {
        this.collapsedGroups.add(groupId);
      }
    },
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

.group {
  margin-top: 40px;
  max-width: 100vw;
  display: flex;
  align-items: center;
  flex-direction: column;
  padding-left: 20px;
  padding-right: 20px;

  .group-header {
    color: white;
    background-color: $main_dark;
    height: 50px;
    width: 100%;
    margin-bottom: 20px;
    font-size: 20px;
    border-radius: 10px;
    box-sizing: border-box;
    padding: 0px 20px;
    line-height: 50px;
    position: relative;
    cursor: pointer;

    &:hover {
      background-color: $main_light;
    }

    .collapse-indicator {
      position: absolute;
      right: 20px;
      top: 10px;
      width: 20px;
      height: 30px;
      // transition: transform 200ms;

      &.collapsed {
        transform: rotate(90deg);
      }
    }
  }

  .controls {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    overflow: hidden;
    // transition: height 200ms;

    &.collapsed {
      height: 0px !important;
    }

    .control-wrapper {
      box-sizing: border-box;
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
}
</style>
