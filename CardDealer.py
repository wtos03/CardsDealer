#!/usr/bin/env python3
# Copyright 2019 Amazon.com, Inc. or its affiliates.  All Rights Reserved.
# 
# You may not use this file except in compliance with the terms and conditions 
# set forth in the accompanying LICENSE.TXT file.
#
# THESE MATERIALS ARE PROVIDED ON AN "AS IS" BASIS. AMAZON SPECIFICALLY DISCLAIMS, WITH 
# RESPECT TO THESE MATERIALS, ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING 
# THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
# 
# 18/12/2018  Modified by Wichai to accept Alexa playing cards skill

import os
import sys
import time
import logging
import json
import random
import threading

from enum import Enum
from agt import AlexaGadget

from ev3dev2.led import Leds
from ev3dev2.sound import Sound
from ev3dev2.motor import OUTPUT_A, OUTPUT_B, LargeMotor, SpeedPercent, MediumMotor
from ev3dev2.sensor import INPUT_1,INPUT_2         
from ev3dev2.sensor.lego import ColorSensor,TouchSensor
# Set the logging level to INFO to see messages from AlexaGadget
logging.basicConfig(level=logging.INFO, stream=sys.stdout, format='%(message)s')
logging.getLogger().addHandler(logging.StreamHandler(sys.stderr))
logger = logging.getLogger(__name__)


class Direction(Enum):
    """
    The list of directional commands and their variations.
    These variations correspond to the skill slot values.
    """
    FORWARD = ['forward', 'forwards', 'go forward']
    BACKWARD = ['back', 'backward', 'backwards', 'go backward']
    STOP = ['stop', 'brake']


class Command(Enum):
    """
    The list of preset commands and their invocation variation.
    These variations correspond to the skill slot values.
    """
    ADD_CMD = ['player', 'players','users','user']
    RESET_GAME = ['reset','replay']
    GAMES = ['rummy','poker','blackjack']

class MindstormsGadget(AlexaGadget):
    """
    A Mindstorms gadget that performs movement based on voice commands.
    
    """

    def __init__(self):
        """
        Performs Alexa Gadget initialization routines and ev3dev resource allocation.
        """
        super().__init__()
        # Ev3dev initialization
        self.leds = Leds()
        self.sound = Sound()
        self.drive = LargeMotor(OUTPUT_B)
        self.dealmotor = MediumMotor(OUTPUT_A)
        self.bcolor = ColorSensor(INPUT_1)
        self.pushsensor = TouchSensor(INPUT_2)
        self.leftmargin = 0
        self.rigtmargin = 0
        self._init_reset()

    def _init_reset(self):
        self.numCards = 2
        self.numPlayers = 0
        self.game = 'blackjack'
        self.degreeStep = 180
        self.players = ["red","yellow"] #Default player

    def on_connected(self, device_addr):
        """
        Gadget connected to the paired Echo device.
        :param device_addr: the address of the device we connected to
        """
        self.leds.set_color("LEFT", "GREEN")
        self.leds.set_color("RIGHT", "GREEN")
        logger.info("{} connected to Echo device".format(self.friendly_name))

    def on_disconnected(self, device_addr):
        """
        Gadget disconnected from the paired Echo device.
        :param device_addr: the address of the device we disconnected from
        """
        self.leds.set_color("LEFT", "BLACK")
        self.leds.set_color("RIGHT", "BLACK")
        logger.info("{} disconnected from Echo device".format(self.friendly_name))

    def on_custom_mindstorms_gadget_control(self, directive):
        """
        Handles the Custom.Mindstorms.Gadget control directive.
        :param directive: the custom directive with the matching namespace and name
        """
        try:
            payload = json.loads(directive.payload.decode("utf-8"))
            print("Control payload: {}".format(payload), file=sys.stderr)
            control_type = payload["type"]
            if control_type == "move":
                # Expected params: [direction, duration, speed]
                self._move(payload["direction"], int(payload["duration"]), int(payload["speed"]))

            if control_type == "command":
                # Expected params: [command]
                self._activate(payload["command"])
            
            if control_type == "dealcard":
                # Expected params: [command] = Number of Cards
                # Expected params: [player]
                player = payload["player"]
                num = self.players.index(player)
                self._dealcard(int(payload["command"]),num)               
        except KeyError:
            print("Missing expected parameters: {}".format(directive), file=sys.stderr)

    def _dealcard(self, num, player):
        """
        Deal  number of cards to player
        """
        if num < 1:
            num = 1
        degree = self._calcDegree(player)
        print("Give player : {} card : {}  Move angle : {}".format(player, num,degree), file=sys.stderr)
        self.drive.on_to_position(SpeedPercent(10),degree) 
        self.drive.wait_until_not_moving()  
        for i in range(num):
            self.dealmotor.on_for_degrees(SpeedPercent(-100), 340)
            self.dealmotor.wait_until_not_moving()
            time.sleep(1)
            self.dealmotor.on_for_degrees(SpeedPercent(100), 270)
            self.dealmotor.wait_until_not_moving()
            time.sleep(1)
 
    def _calcDegree (self,player):
        degree = (player*self.degreeStep)+self.leftmargin
        return degree

    def _gameinit(self,game):
        """
        Check and start game
        """
        if (self.numPlayers == 0):
            self.numPlayers = 2
        if game == "poker":
            self.numCards = 5
        if game == "blackjack":
            self.numCards = 2
        if game == "rummy":
            self.numCards = 7
            if (self.numPlayers == 2):
                self.numCards = 10

        self._findboundary()    
        self.drive.on_to_position(SpeedPercent(10),self.leftmargin)    
        time.sleep(1)
        print("Game : {}  Number of Card : {}".format(game,self.numCards), file=sys.stderr)
        for i in  range(self.numCards):
            for j in range(self.numPlayers):
                self._dealcard(1,j)
        for i in range(self.numPlayers):
            print("Player : {}  Color : {}".format(i,self.players[i]), file=sys.stderr)
            
    def _findboundary (self):
        "Move to left until sensor pressed "
        self.drive.on(SpeedPercent(10))
        self.pushsensor.wait_for_pressed ()
        self.drive.stop()
        "Get position"
        self.rightmargin = self.drive.position
        print("Right position  : {}  ".format(self.rightmargin), file=sys.stderr)
        self.drive.on(SpeedPercent(-10))
        time.sleep(1)
        self.pushsensor.wait_for_pressed ()
        self.drive.stop()
        "Get position + offset 45 for not to close limitation"
        self.leftmargin = self.drive.position
        self.leftmargin = self.leftmargin + 45 
        print("Left position  : {}  ".format(self.leftmargin), file=sys.stderr)
        self.degreeStep = int(abs((self.leftmargin - self.rightmargin)/self.numPlayers))
        print("Degree steps  : {}  ".format(self.degreeStep), file=sys.stderr)
      
    def _addUser (self):
        if self.numPlayers == 0:
            self.players.clear()
        player = self.bcolor.color_name
        self.players.append(player.lower())
        print("Player {} color: {}".format(self.players[self.numPlayers],player), file=sys.stderr)
        self.numPlayers  += 1


    def _move(self, direction, duration: int, speed: int, is_blocking=False):
        """
        Handles move commands from the directive.
        Right and left movement can under or over turn depending on the surface type.
        :param direction: the move direction
        :param duration: the duration in seconds
        :param speed: the speed percentage as an integer
        :param is_blocking: if set, motor run until duration expired before accepting another command
        """
        print("Move command: ({}, {}, {}, {})".format(direction, speed, duration, is_blocking), file=sys.stderr)
        if direction in Direction.FORWARD.value:
            self.drive.on_for_degrees(SpeedPercent(10),90)

        if direction in Direction.BACKWARD.value:
            self.drive.on_for_degrees(SpeedPercent(-10),90)
        if direction in Direction.STOP.value:
            self.drive.off()

    def _activate(self, command, speed=50):
        """
        Handles preset commands.
        :param command: the preset command
        :param speed: the speed if applicable
        """
        print("Activate command: ({}, {})".format(command, speed), file=sys.stderr)
        if command in Command.GAMES.value:
            self.game = command
            print("Play game: {}".format(self.game), file=sys.stderr)
            self._gameinit(self.game)

        if command in Command.RESET_GAME.value:
            # Reset game
            self._init_reset()

        if command in Command.ADD_CMD.value:
            self._addUser()

  
  
if __name__ == '__main__':

    gadget = MindstormsGadget()

    # Set LCD font and turn off blinking LEDs
    os.system('setfont Lat7-Terminus12x6')
    gadget.leds.set_color("LEFT", "BLACK")
    gadget.leds.set_color("RIGHT", "BLACK")

    # Startup sequence
    gadget.sound.play_song((('C4', 'e'), ('D4', 'e'), ('E5', 'q')))
    gadget.leds.set_color("LEFT", "GREEN")
    gadget.leds.set_color("RIGHT", "GREEN")

    # Gadget main entry point
    gadget.main()

    # Shutdown sequence
    gadget.sound.play_song((('E5', 'e'), ('C4', 'e')))
    gadget.leds.set_color("LEFT", "BLACK")
    gadget.leds.set_color("RIGHT", "BLACK")
