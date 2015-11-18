var app = angular.module('app');

app.controller('profileCtrl', [
    '$rootScope',
    '$scope',
    '$stateParams',
    '$location',
    '$localStorage',
    'api',
    'bungie',
    'consts',
    'charts',
    'auditFactory',

    function ($rootScope, $scope, $stateParams, $location, $localStorage, api, bungie, consts, charts, auditFactory) {
        //var audit = new auditFactory($scope);
        $scope.mode = $localStorage.profileMode ? $localStorage.profileMode : 5;
        $scope.modes = consts.modes;
        $scope.modeIcons = consts.modeIcons;
        $scope.classes = consts.classes;
        $scope.chart = charts.get('elo');
        $scope.loading = {
            activityHistory: true,
            elo: true,
            eloHistory: true,
            fireteam: true,
            name: true,
            character: true,
            inventory: true
        };

        var load = function(platform, membershipId) {
            $scope.setMode = function(mode, force) {
                if ($scope.mode == mode && !force) {
                    return;
                }

                $localStorage.profileMode = mode;

                $scope.mode = mode;

                $scope.loading.activityHistory = true;
                $scope.loading.fireteam = true;
                bungie
                    .getActivityHistory(
                        platform,
                        membershipId,
                        $scope.character.characterBase.characterId,
                        mode
                    )
                    .then(function(result) {
                        var defs = result.data.Response.definitions.activities;
                        $scope.activities = result.data.Response.data.activities;

                        if (typeof $scope.activities == "undefined") {
                            $scope.activities = [];
                        }

                        _.each($scope.activities, function(activity) {
                            activity.definition = defs[activity.activityDetails.referenceId];
                        });

                        $scope.loading.activityHistory = false;
                        //return api.getFireteam(mode, membershipId);
                    });
                    //.then(function(result) {
                    //    $scope.fireteam = result.data;
                    //    $scope.loading.fireteam = false;
                    //});
            };

            $scope.loadInventory = function() {
                $scope.loading.inventory = true;

                bungie
                    .getInventory(
                    platform,
                    membershipId,
                    $scope.character.characterBase.characterId
                )
                    .then(function(response) {
                        $scope.items = response.data.Response.data.buckets.Equippable;
                        $scope.definitions = response.data.Response.definitions;
                        //audit.setLoadout($scope.items);
                        //audit.setDefinitions($scope.definitions);
                        $scope.loading.inventory = false;
                    });
            };

            $scope.changeCharacter = function(index) {
                if (index == $scope.characterIndex) {
                    return;
                }

                $scope.characterIndex = index;
                $scope.character = $scope.characters[$scope.characterIndex];
                //audit.setCharacter($scope.character);

                $scope.setMode($scope.mode, true);
                $scope.loadInventory();
            };

            $scope.statToTier = function(stat) {
                var normalized = Math.floor(stat / 60);
                if (normalized > 5) {
                    return 5;
                } else {
                    return normalized;
                }
            };

            $scope.getSuperCooldown = function(stat, items) {
                var tiers = {};
                var subClass = _.find(items, function(i) {
                    return i.bucketHash == consts.buckets['subclass'];
                });
                if (subClass) {
                    if ([3658182170,2007186000,2455559914,4143670657].indexOf(subClass.items[0].itemHash) > -1 ) {
                        tiers = {
                            0: '5:00',
                            1: '4:46',
                            2: '4:31',
                            3: '4:15',
                            4: '3:58',
                            5: '3:40'
                        };
                    } else {
                        tiers = {
                            0: '5:30',
                            1: '5:14',
                            2: '4:57',
                            3: '4:39',
                            4: '4:20',
                            5: '4:00'
                        };
                    }
                    return tiers[$scope.statToTier(stat)];
                }
            };

            $scope.getUtilityCooldown = function(stat) {
                var tiers = {
                    0: '1:00',
                    1: '0:55',
                    2: '0:49',
                    3: '0:42',
                    4: '0:34',
                    5: '0:25'
                };

                return tiers[$scope.statToTier(stat)];
            };

            $scope.loading.elo = true;
            api
                .getEloByMembershipId(membershipId)
                .then(function(result) {
                    _.each(result.data, function(elo) {
                        elo.league = consts.ratingToLeague(elo.elo);
                    });

                    result.data.sort(function(a, b) {
                        if (b.rank == -2 && a.rank == -1) {
                            return 1;
                        }
                        return b.elo - a.elo;
                    });

                    console.log(result.data);

                    $scope.elos = result.data;
                    $scope.loading.elo = false;
                });

            $scope.loading.eloHistory = true;
            api
                .getEloChart(membershipId)
                .then(function(result) {
                    _.each(result.data, function(row) {
                        if (!$scope.chart.series[row.mode]) {
                            $scope.chart.series[row.mode] = {
                                data: [],
                                name: $scope.modes[row.mode],
                                lineWidth: 2
                            }
                        }
                        $scope.chart.series[row.mode].data.push(row);
                    });

                    $scope.chartEmpty = Object.keys($scope.chart.series).length == 0;

                    $scope.loading.eloHistory = false;
                });

            $scope.loading.character = true;
            bungie
                .getAccount(platform, membershipId)
                .success(function(result) {
                    $scope.characters = result.Response.data.characters;

                    var idx = 0;
                    var maxLastPlayed = 0;

                    _.each($scope.characters, function(c, i) {
                        var lastPlayed = moment(c.characterBase.dateLastPlayed).unix();
                        if (lastPlayed > maxLastPlayed) {
                            idx = i;
                            maxLastPlayed = lastPlayed;
                        }
                    });

                    $scope.loading.character = false;
                    $scope.changeCharacter(idx);
                });
        };

        bungie
            .searchForPlayer($stateParams.platform, $stateParams.name)
            .success(function(result) {
                if (result.Response.length == 0) {
                    $location.url('/');
                    return;
                }

                $scope.name = result.Response[0].displayName;
                $rootScope.title = $scope.name + ' - Destiny PvP Profile - Guardian.gg';
                $scope.loading.name = false;
                load(result.Response[0].membershipType, result.Response[0].membershipId);
            });

        $scope.$on('$destroy', function() {
            angular.element('body').find('.tooltip').remove();
        });
    }
]);