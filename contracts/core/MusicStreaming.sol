// contracts/core/MusicStreaming.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./RightsManager.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MusicStreaming is ReentrancyGuard {
    RightsManager public rightsManager;

    struct Stream {
        uint256 startTime;
        uint256 endTime;
        uint256 duration;
        address user;
        bool isActive;
        uint256 payment; // 支払い額を記録
    }

    mapping(uint256 => Stream[]) public streams;
    mapping(address => mapping(uint256 => bool)) public activeStreams;

    uint256 public constant MINIMUM_STREAM_PAYMENT = 0.001 ether;

    event StreamStarted(
        uint256 indexed tokenId,
        address indexed user,
        uint256 payment
    );
    event StreamEnded(
        uint256 indexed tokenId,
        address indexed user,
        uint256 duration
    );

    constructor(address _rightsManager) {
        rightsManager = RightsManager(_rightsManager);
    }

    modifier onlyLicenseHolder(uint256 tokenId) {
        require(
            rightsManager.hasValidLicense(msg.sender, tokenId),
            "No valid license"
        );
        _;
    }

    // プレイリスト機能の追加
    struct Playlist {
        string name;
        uint256[] musicIds;
        address creator;
        bool isPublic;
        uint256 likeCount; // プレイリストへのいいね数を追加
        uint256 reputation; // キュレーターとしての評価
    }

    mapping(uint256 => Playlist) public playlists;
    uint256 public playlistCount;

    // いいね機能の追加
    mapping(uint256 => mapping(address => bool)) public likes;
    mapping(uint256 => uint256) public likesCount;

    // コメント機能の追加
    struct Comment {
        address user;
        string content;
        uint256 timestamp;
    }
    mapping(uint256 => Comment[]) public comments;

    // ユーザープロファイル機能の追加
    struct UserProfile {
        string name;
        string avatarURI;
        uint256[] playlists;
        uint256[] followers;
        uint256[] following;
    }

    mapping(address => UserProfile) public userProfiles;
    mapping(uint256 => mapping(address => bool)) public playlistFollowers;
    mapping(uint256 => uint256) public musicPopularityScore; // 音楽の人気度スコア

    event ProfileUpdated(address indexed user, string name, string avatarURI);
    event PlaylistFollowed(
        uint256 indexed playlistId,
        address indexed follower
    );
    event PlaylistCreated(
        uint256 indexed playlistId,
        address curator,
        string name
    );
    event MusicCurated(uint256 indexed musicId, uint256 indexed playlistId);
    event CuratorReputationUpdated(address indexed curator, uint256 newScore);

    struct CuratorStats {
        uint256 totalLikes;
        uint256 totalFollowers;
        uint256 playlistCount;
        uint256 reputation;
        bool isActive;
    }

    mapping(address => CuratorStats) public curatorStats;
    address[] public curators;
    
    event PlaylistLiked(uint256 indexed playlistId, address indexed user);

    mapping(uint256 => mapping(address => bool)) public playlistLikes;

    function startStream(
        uint256 tokenId
    ) external payable onlyLicenseHolder(tokenId) nonReentrant {
        require(msg.value >= MINIMUM_STREAM_PAYMENT, "Insufficient payment");
        require(!activeStreams[msg.sender][tokenId], "Already streaming");

        streams[tokenId].push(
            Stream({
                startTime: block.timestamp,
                endTime: 0,
                duration: 0,
                user: msg.sender,
                isActive: true,
                payment: msg.value // 支払い額を記録
            })
        );

        activeStreams[msg.sender][tokenId] = true;

        // 支払いの処理
        address artist = rightsManager.tokenArtists(tokenId);
        require(artist != address(0), "Artist not found");

        (bool success, ) = payable(artist).call{value: msg.value}("");
        require(success, "Payment failed");

        emit StreamStarted(tokenId, msg.sender, msg.value);
    }

    function endStream(uint256 tokenId) external nonReentrant {
        require(activeStreams[msg.sender][tokenId], "No active stream");

        uint256 streamIndex = streams[tokenId].length - 1;
        Stream storage currentStream = streams[tokenId][streamIndex];

        require(currentStream.user == msg.sender, "Not stream owner");

        currentStream.endTime = block.timestamp;
        currentStream.duration =
            currentStream.endTime -
            currentStream.startTime;
        currentStream.isActive = false;

        activeStreams[msg.sender][tokenId] = false;

        // ストリームの記録
        rightsManager.recordStream(tokenId, msg.sender);

        emit StreamEnded(tokenId, msg.sender, currentStream.duration);
    }

    function getStreamHistory(
        uint256 tokenId
    ) external view returns (Stream[] memory) {
        return streams[tokenId];
    }

    // 新規機能の追加
    function createPlaylist(string memory _name, bool _isPublic) external {
        playlistCount++;
        playlists[playlistCount] = Playlist(
            _name,
            new uint256[](0),
            msg.sender,
            _isPublic,
            0,
            0
        );
    }

    function addToPlaylist(uint256 _playlistId, uint256 _musicId) external {
        require(
            playlists[_playlistId].creator == msg.sender,
            "Not playlist owner"
        );
        playlists[_playlistId].musicIds.push(_musicId);
    }

    function likeMusic(uint256 _musicId) external {
        require(!likes[_musicId][msg.sender], "Already liked");
        likes[_musicId][msg.sender] = true;
        likesCount[_musicId]++;
    }

    function addComment(uint256 _musicId, string memory _content) external {
        comments[_musicId].push(Comment(msg.sender, _content, block.timestamp));
    }

    // ソーシャル機能の追加
    function updateProfile(
        string memory name,
        string memory avatarURI
    ) external {
        UserProfile storage profile = userProfiles[msg.sender];
        profile.name = name;
        profile.avatarURI = avatarURI;
        emit ProfileUpdated(msg.sender, name, avatarURI);
    }

    function followPlaylist(uint256 playlistId) external {
        require(playlists[playlistId].isPublic, "Playlist is private");
        require(
            !playlistFollowers[playlistId][msg.sender],
            "Already following"
        );

        playlistFollowers[playlistId][msg.sender] = true;
        UserProfile storage profile = userProfiles[msg.sender];
        profile.playlists.push(playlistId);

        emit PlaylistFollowed(playlistId, msg.sender);
    }

    // プレイリスト作成（キュレーション）機能
    function createCuratedPlaylist(
        string memory _name,
        string memory /* _description */, // 未使用パラメータをコメントアウト
        uint256[] memory _musicIds,
        bool _isPublic
    ) external {
        require(_musicIds.length > 0, "Playlist must contain music");

        playlistCount++;
        playlists[playlistCount] = Playlist({
            name: _name,
            musicIds: _musicIds,
            creator: msg.sender,
            isPublic: _isPublic,
            likeCount: 0,
            reputation: 0
        });

        // キュレーション評価の更新
        updateCuratorReputation(msg.sender);

        emit PlaylistCreated(playlistCount, msg.sender, _name);
        for (uint i = 0; i < _musicIds.length; i++) {
            emit MusicCurated(_musicIds[i], playlistCount);
            updateMusicPopularity(_musicIds[i]);
        }
    }

    // 音楽の人気度スコアの更新
    function updateMusicPopularity(uint256 musicId) internal {
        uint256 baseScore = likesCount[musicId];
        uint256 playlistAppearances = getPlaylistAppearances(musicId);
        uint256 streamCount = getStreamCount(musicId);

        musicPopularityScore[musicId] = calculatePopularityScore(
            baseScore,
            playlistAppearances,
            streamCount
        );
    }

    // キュレーターの評価を更新
    function updateCuratorReputation(address curator) internal {
        CuratorStats storage stats = curatorStats[curator];
        
        if (!stats.isActive) {
            stats.isActive = true;
            curators.push(curator);
        }

        uint256 followerCount = 0;
        uint256 likeCount = 0;
        uint256 curatorPlaylistCount = getUserPlaylistCount(curator);

        for (uint256 i = 1; i <= curatorPlaylistCount; i++) {
            if (playlists[i].creator == curator) {
                followerCount += getPlaylistFollowerCount(i);
                likeCount += playlists[i].likeCount;
            }
        }

        uint256 newReputation = calculateReputation(
            likeCount,
            followerCount,
            curatorPlaylistCount
        );

        stats.reputation = newReputation;
        emit CuratorReputationUpdated(curator, newReputation);
    }

    // シャドーイングを避けるために変数名を変更
    function calculateReputation(
        uint256 likeCount,
        uint256 followerCount,
        uint256 curatedPlaylistCount  // playlistCount → curatedPlaylistCount に変更
    ) internal pure returns (uint256) {
        return (likeCount * 3 + followerCount * 2 + curatedPlaylistCount) / 6;
    }

    function getTopCurators() external view returns (address[] memory) {
        address[] memory sortedCurators = curators;
        // バブルソートで並び替え（実際の実装ではより効率的なアルゴリズムを使用）
        for (uint i = 0; i < sortedCurators.length; i++) {
            for (uint j = 0; j < sortedCurators.length - 1 - i; j++) {
                if (curatorStats[sortedCurators[j]].reputation < 
                    curatorStats[sortedCurators[j + 1]].reputation) {
                    address temp = sortedCurators[j];
                    sortedCurators[j] = sortedCurators[j + 1];
                    sortedCurators[j + 1] = temp;
                }
            }
        }
        return sortedCurators;
    }

    function likePlaylist(uint256 playlistId) external {
        require(playlists[playlistId].isPublic, "Playlist is private");
        require(!playlistLikes[playlistId][msg.sender], "Already liked");

        playlistLikes[playlistId][msg.sender] = true;
        playlists[playlistId].likeCount++;

        address curator = playlists[playlistId].creator;
        curatorStats[curator].totalLikes++;
        updateCuratorReputation(curator);

        emit PlaylistLiked(playlistId, msg.sender);
    }

    // 推薦システム
    function getRecommendedMusic(
        address user
    ) external view returns (uint256[] memory) {
        return
            recommendBasedOnPreferences(
                getUserListeningHistory(user),
                getUserLikes(user),
                getUserFollowedPlaylists(user)
            );
    }

    // pure修飾子の追加と未使用パラメータの処理
    function generateRecommendations(
        uint256[] memory /* userLikes */,
        uint256[] memory /* followedPlaylists */
    ) internal pure returns (uint256[] memory) {
        uint256[] memory recommendations = new uint256[](10);
        // 実装予定のロジック
        return recommendations;
    }

    // 未実装だった補助関数の追加
    function getUserPlaylistCount(address user) public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i <= playlistCount; i++) {
            if (playlists[i].creator == user) {
                count++;
            }
        }
        return count;
    }

    function getPlaylistFollowerCount(uint256 playlistId) public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < curators.length; i++) {
            if (playlistFollowers[playlistId][curators[i]]) {
                count++;
            }
        }
        return count;
    }

    function getUserListeningHistory(address user) public view returns (uint256[] memory) {
        uint256[] memory history = new uint256[](playlistCount);
        uint256 count = 0;
        for (uint256 i = 1; i <= playlistCount; i++) {
            if (activeStreams[user][i]) {
                history[count] = i;
                count++;
            }
        }
        return history;
    }

    function getUserLikes(address user) public view returns (uint256[] memory) {
        uint256[] memory userLikes = new uint256[](playlistCount);
        uint256 count = 0;
        for (uint256 i = 1; i <= playlistCount; i++) {
            if (likes[i][user]) {
                userLikes[count] = i;
                count++;
            }
        }
        return userLikes;
    }

    function getUserFollowedPlaylists(address user) public view returns (uint256[] memory) {
        return userProfiles[user].playlists;
    }

    function getStreamCount(uint256 musicId) public view returns (uint256) {
        return streams[musicId].length;
    }

    function getPlaylistAppearances(uint256 musicId) public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i <= playlistCount; i++) {
            uint256[] memory musicIds = playlists[i].musicIds;
            for (uint256 j = 0; j < musicIds.length; j++) {
                if (musicIds[j] == musicId) {
                    count++;
                    break;
                }
            }
        }
        return count;
    }

    function calculatePopularityScore(
        uint256 baseScore,
        uint256 appearances,
        uint256 streamCount
    ) internal pure returns (uint256) {
        return (baseScore * 3 + appearances * 2 + streamCount) / 6;
    }

    // 重複している関数の削除
    // getRecommendedMusic関数が2回定義されていたため、1つを削除

    // キュレーターのプロフィール更新
    function updateCuratorProfile(address curator, uint256 newScore) internal {
        CuratorStats storage stats = curatorStats[curator];
        stats.reputation = newScore;
    }

    // 推薦アルゴリズムの実装
    function recommendBasedOnPreferences(
        uint256[] memory /* historyIds */,
        uint256[] memory /* likedMusicIds */,
        uint256[] memory /* followedPlaylistIds */
    ) internal pure returns (uint256[] memory) {
        uint256[] memory recommendations = new uint256[](10);
        // 実際の推薦ロジックをここに実装
        // この例では簡単な実装を提供
        return recommendations;
    }
}
